import argparse
import json
import nltk
import openai
import sys
import os
from dotenv import load_dotenv

from pydantic import BaseModel
from typing import List
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
from rouge_score import rouge_scorer
from nltk.translate.meteor_score import meteor_score

nltk.download('punkt')
nltk.download('wordnet')

load_dotenv()

api_key = os.getenv('OPENAI_API_KEY')
default_model = os.getenv('DEFAULT_MODEL')
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables. Please add it to your .env file.")
if not default_model:
    raise ValueError("DEFAULT_MODEL not found in environment variables. Please add it to your .env file.")

client = openai.OpenAI(api_key=api_key)

class AttributeScore(BaseModel):
    score: float
    explanation: str

class EvaluationResult(BaseModel):
    accuracy: AttributeScore
    relevance: AttributeScore
    coherence: AttributeScore

    ethical_considerations: AttributeScore
    professionalism: AttributeScore
    reasoning: AttributeScore
    creativity: AttributeScore
    overall_score: float


ACCURACY_PROMPT = """You are an expert evaluator focusing solely on accuracy. Assess how closely the response matches the expected answer:

Scoring criteria:
- 0.9-1.0: Perfect match with no errors
- 0.7-0.89: Largely correct with minor errors
- 0.5-0.69: Some correct info but significant errors
- 0.25-0.49: Limited understanding, mostly incorrect
- 0-0.24: Entirely incorrect

Provide the score and a detailed explanation for your assessment."""

RELEVANCE_PROMPT = """You are an expert evaluator focusing solely on relevance. Assess how directly the response addresses the question.

Scoring criteria:
- 0.9-1.0: Perfectly addresses the core question
- 0.7-0.89: Mostly relevant with minor tangents
- 0.5-0.69: Partially relevant with significant deviation
- 0.25-0.49: Mostly irrelevant but touches on topic
- 0-0.24: Completely off-topic

Provide the score and a detailed explanation for your assessment."""

COHERENCE_PROMPT = """You are an expert evaluator focusing solely on coherence. Assess how logically structured and consistent the response is.

Scoring criteria:
- 0.9-1.0: Perfect logical flow and consistency
- 0.7-0.89: Generally well-structured with minor issues
- 0.5-0.69: Somewhat organized but with clarity issues
- 0.25-0.49: Poorly structured with significant confusion
- 0-0.24: Completely incoherent

Provide the score and a detailed explanation for your assessment."""

CONTEXT_ADHERENCE_PROMPT = """You are an expert evaluator focusing solely on context adherence. Assess how well the response aligns with and remains faithful to the given context:

Scoring criteria:
- 0.9-1.0: Perfect alignment with context, uses relevant information appropriately
- 0.7-0.89: Strong context alignment with minor deviations
- 0.5-0.69: Moderate context usage with some irrelevant or missing elements
- 0.25-0.49: Poor context adherence, misses key information
- 0-0.24: Completely ignores or misuses context

Provide the score and a detailed explanation for your assessment."""

ETHICAL_PROMPT = """You are an expert evaluator focusing solely on ethical considerations. Assess how well the content adheres to moral principles:

Scoring criteria:
- 0.9-1.0: Exemplary ethical awareness and consideration
- 0.7-0.89: Strong ethical foundation with minor oversights
- 0.5-0.69: Basic ethical compliance with room for improvement
- 0.25-0.49: Significant ethical concerns present
- 0-0.24: Serious ethical violations or harmful content

Provide the score and a detailed explanation for your assessment."""

PROFESSIONALISM_PROMPT = """You are an expert evaluator focusing solely on professionalism. Assess how well the content meets professional standards:

Scoring criteria:
- 0.9-1.0: Exceptional professionalism and formal communication
- 0.7-0.89: Professional with minor informal elements
- 0.5-0.69: Generally professional but with notable lapses
- 0.25-0.49: Significantly unprofessional elements
- 0-0.24: Completely unprofessional or inappropriate

Provide the score and a detailed explanation for your assessment."""

REASONING_PROMPT = """You are an expert evaluator focusing solely on reasoning quality. Assess how well the response supports its conclusions:

Scoring criteria:
- 0.9-1.0: Exceptional logical flow and well-supported conclusions
- 0.7-0.89: Strong reasoning with minor logical gaps
- 0.5-0.69: Basic reasoning present but needs stronger support
- 0.25-0.49: Weak or flawed reasoning
- 0-0.24: No clear reasoning or completely illogical

Provide the score and a detailed explanation for your assessment."""

CREATIVITY_PROMPT = """You are an expert evaluator focusing solely on creativity and originality. Assess how well the content presents novel ideas:

Scoring criteria:
- 0.9-1.0: Highly innovative and original perspective
- 0.7-0.89: Creative approach with some unique elements
- 0.5-0.69: Standard approach with occasional creative elements
- 0.25-0.49: Mostly conventional with little originality
- 0-0.24: Completely conventional or derivative

Provide the score and a detailed explanation for your assessment."""

def evaluate_single_attribute(question: str, response: str, expected_answer: str, system_prompt: str) -> AttributeScore:
    completion = client.beta.chat.completions.parse(
        model=default_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"""
            Question: {question}
            Response to evaluate: {response}
            Correct Reference answer: {expected_answer}

            Evaluate the response based on the given criteria."""}
        ],
        response_format=AttributeScore,
    )
    
    return completion.choices[0].message.parsed

class ResponseEvaluator:
    def __init__(self):
        self.rouge_scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)

    def calculate_bleu(self, reference, response):
        reference_tokens = nltk.word_tokenize(reference.lower())
        response_tokens = nltk.word_tokenize(response.lower())
        score = sentence_bleu(
            [reference_tokens],
            response_tokens,
            smoothing_function=SmoothingFunction().method1
        )
        
        return {
            'score': score,
            'details': {
                'method': 'BLEU',
                'reference_tokens': reference_tokens,
                'response_tokens': response_tokens
            }
        }

    def calculate_rouge(self, reference, response):
        scores = self.rouge_scorer.score(reference, response)
        return {
            'score': scores['rougeL'].fmeasure,
            'details': {
                'method': 'ROUGE',
                'rouge1': scores['rouge1']._asdict(),
                'rouge2': scores['rouge2']._asdict(),
                'rougeL': scores['rougeL']._asdict()
            }
        }

    def calculate_meteor(self, reference, response):
        reference_tokens = nltk.word_tokenize(reference.lower())
        response_tokens = nltk.word_tokenize(response.lower())
        score = meteor_score([reference_tokens], response_tokens)
        return {
            'score': score,
            'details': {
                'method': 'METEOR',
                'reference_tokens': reference_tokens,
                'response_tokens': response_tokens
            }
        }
    
    def llm_judge(self, question: str, response: str, reference: str, context: str = None) -> EvaluationResult:

        accuracy = evaluate_single_attribute(question, response, reference, ACCURACY_PROMPT)
        relevance = evaluate_single_attribute(question, response, reference, RELEVANCE_PROMPT)
        coherence = evaluate_single_attribute(question, response, reference, COHERENCE_PROMPT)
        ethical = evaluate_single_attribute(question, response, reference, ETHICAL_PROMPT)
        professionalism = evaluate_single_attribute(question, response, reference, PROFESSIONALISM_PROMPT)
        reasoning = evaluate_single_attribute(question, response, reference, REASONING_PROMPT)
        creativity = evaluate_single_attribute(question, response, reference, CREATIVITY_PROMPT)
        

        context_adherence = None
        if context:
            context_adherence = evaluate_single_attribute(question, response, reference, CONTEXT_ADHERENCE_PROMPT)
        
        weights = {
            'accuracy': 0.25,
            'relevance': 0.15,
            'coherence': 0.15,
            'ethical_considerations': 0.1,
            'professionalism': 0.1,
            'reasoning': 0.15,
            'creativity': 0.1
        }
        
        scores = {
            'accuracy': accuracy.score,
            'relevance': relevance.score,
            'coherence': coherence.score,
            'ethical_considerations': ethical.score,
            'professionalism': professionalism.score,
            'reasoning': reasoning.score,
            'creativity': creativity.score
        }
        
        if context_adherence:
            weights = {k: v * 0.9 for k, v in weights.items()}
            weights['context_adherence'] = 0.1
            scores['context_adherence'] = context_adherence.score
        
        overall_score = sum(score * weights[attr] for attr, score in scores.items())
        
        return EvaluationResult(
            accuracy=accuracy,
            relevance=relevance,
            coherence=coherence,
            context_adherence=context_adherence,
            ethical_considerations=ethical,
            professionalism=professionalism,
            reasoning=reasoning,
            creativity=creativity,
            overall_score=overall_score
        )

    def evaluate(self, question, response, reference, methods=None):
        if methods is None:
            methods = ['LLM_JUDGE']
            
        results = {}
        
        for method in methods:
            try:
                print(f"Reference: {reference}", file=sys.stderr)
                print(f"Response: {response}", file=sys.stderr)
                print(f"Method: ", method, file=sys.stderr)
                if method == 'BLEU':                
                    results[method] = self.calculate_bleu(reference, response)
                elif method == 'ROUGE':
                    results[method] = self.calculate_rouge(reference, response)
                elif method == 'METEOR':
                    results[method] = self.calculate_meteor(reference, response)
                elif method == 'LLM_JUDGE':
                    results[method] = self.llm_judge(question, response, reference)
                else:
                    results[method] = {
                        'score': 0,
                        'details': {
                            'method': method,
                            'error': 'Unsupported evaluation method'
                        }
                    }
            except Exception as e:
                results[method] = {
                    'score': 0,
                    'details': {
                        'method': method,
                        'error': str(e)
                    }
                }
        
        return results

def main():
    parser = argparse.ArgumentParser(description='Evaluate model responses using various methods')
    parser.add_argument('--methods', required=True, help='Comma-separated list of evaluation methods')
    parser.add_argument('--user-message', required=True, help='Original user message')
    parser.add_argument('--expected', required=True, help='Expected response')
    parser.add_argument('--response', required=True, help='Model response')
    
    args = parser.parse_args()
    methods = args.methods.split(',')
    
    evaluator = ResponseEvaluator()
    results = evaluator.evaluate(args.user_message, args.response, args.expected, methods)
    print(json.dumps(results))

if __name__ == '__main__':
    main() 