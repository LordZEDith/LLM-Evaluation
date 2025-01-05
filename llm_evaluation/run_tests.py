import json
import sys
import os
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from models import generate_model_response
from evaluator import ResponseEvaluator

# Print virtual environment information
#print("Python executable:", sys.executable)
#print("Python version:", sys.version)

@dataclass
class TestCase:
    id: str
    prompt: str
    expected_response: str
    system_prompt: Optional[str] = None
    context: Optional[str] = None

@dataclass
class TestResult:
    test_case_id: str
    prompt: str
    model_response: str
    expected_response: str
    evaluation_result: dict
    error: Optional[str] = None

    def to_dict(self):
        return {
            "test_case_id": self.test_case_id,
            "prompt": self.prompt,
            "model_response": self.model_response,
            "expected_response": self.expected_response,
            "evaluation_result": self.evaluation_result,
            "error": self.error
        }

def run_single_test(
    test_case: TestCase,
    model_implementation: str,
    specific_model: str,
    api_key: str,
    grading_methods: List[str]
) -> TestResult:
    try:
        model_response = generate_model_response(
            implementation_name=model_implementation,
            api_key=api_key,
            system_prompt=test_case.system_prompt,
            user_prompt=test_case.prompt,
            model=specific_model
        )
        
        evaluator = ResponseEvaluator()
        evaluation = evaluator.evaluate(
            question=test_case.prompt,
            response=model_response,
            reference=test_case.expected_response,
            methods=grading_methods
        )
        
        print("\n=== Test Case Details ===", file=sys.stderr)
        print(f"Question: {test_case.prompt}", file=sys.stderr)
        print(f"Model Response: {model_response}", file=sys.stderr)
        print(f"Reference: {test_case.expected_response}", file=sys.stderr)
        print("\n=== Evaluation Results ===", file=sys.stderr)
        
        evaluation_dict = {}
        for method, result in evaluation.items():
            if method == "LLM_JUDGE":
                evaluation_dict[method] = {
                    "score": float(result.overall_score),
                    "details": {
                        "attributes": {
                            "accuracy": {
                                "score": float(result.accuracy.score),
                                "explanation": result.accuracy.explanation
                            },
                            "relevance": {
                                "score": float(result.relevance.score),
                                "explanation": result.relevance.explanation
                            },
                            "coherence": {
                                "score": float(result.coherence.score),
                                "explanation": result.coherence.explanation
                            },
                            "ethical_considerations": {
                                "score": float(result.ethical_considerations.score),
                                "explanation": result.ethical_considerations.explanation
                            },
                            "professionalism": {
                                "score": float(result.professionalism.score),
                                "explanation": result.professionalism.explanation
                            },
                            "reasoning": {
                                "score": float(result.reasoning.score),
                                "explanation": result.reasoning.explanation
                            },
                            "creativity": {
                                "score": float(result.creativity.score),
                                "explanation": result.creativity.explanation
                            }
                        },
                        "responses": {
                            "input": test_case.prompt,
                            "llm_response": model_response,
                            "reference_response": test_case.expected_response
                        }
                    }
                }
            else:
                score = result['score'] if isinstance(result, dict) else result.score
                evaluation_dict[method] = {
                    "score": float(score),
                    "model_response": model_response,
                    "details": result['details'] if isinstance(result, dict) else result.details
                }
            
            print(f"\n{method} Score: {evaluation_dict[method]['score']:.3f}", file=sys.stderr)
            if method == "BLEU" and "details" in evaluation_dict[method]:
                print("Token comparison:", file=sys.stderr)
                print(f"  Reference: {evaluation_dict[method]['details']['reference_tokens']}", file=sys.stderr)
                print(f"  Response:  {evaluation_dict[method]['details']['response_tokens']}", file=sys.stderr)
            elif method == "ROUGE" and "details" in evaluation_dict[method]:
                print("ROUGE Scores:", file=sys.stderr)
                details = evaluation_dict[method]['details']
                print(f"  ROUGE-1: {details['rouge1']['fmeasure']:.3f}", file=sys.stderr)
                print(f"  ROUGE-2: {details['rouge2']['fmeasure']:.3f}", file=sys.stderr)
                print(f"  ROUGE-L: {details['rougeL']['fmeasure']:.3f}", file=sys.stderr)
        
        print("\n=== End of Test Case ===\n", file=sys.stderr)
        
        return TestResult(
            test_case_id=test_case.id,
            prompt=test_case.prompt,
            model_response=model_response,
            expected_response=test_case.expected_response,
            evaluation_result=evaluation_dict
        )
        
    except Exception as e:
        return TestResult(
            test_case_id=test_case.id,
            prompt=test_case.prompt,
            model_response="",
            expected_response=test_case.expected_response,
            evaluation_result={},
            error=str(e)
        )

def run_all_tests(
    test_cases: List[TestCase],
    model_implementation: str,
    specific_model: str,
    api_key: str,
    grading_methods: List[str]
) -> List[TestResult]:
    results = []
    for test_case in test_cases:
        result = run_single_test(
            test_case=test_case,
            model_implementation=model_implementation,
            specific_model=specific_model,
            api_key=api_key,
            grading_methods=grading_methods
        )
        results.append(result)
    return results

def main():
    try:
        input_data = json.loads(sys.stdin.read())
        test_cases = [
            TestCase(**tc) for tc in input_data["test_cases"]
        ]
        model_implementation = input_data["model_implementation"]
        specific_model = input_data["specific_model"]
        api_key = input_data["api_key"]
        grading_methods = input_data["grading_methods"]
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Failed to parse input: {str(e)}"
        }))
        sys.exit(1)
    
    try:
        results = run_all_tests(
            test_cases=test_cases,
            model_implementation=model_implementation,
            specific_model=specific_model,
            api_key=api_key,
            grading_methods=grading_methods
        )
        
        results_json = [r.to_dict() for r in results]
        
        print(json.dumps({
            "success": True,
            "results": results_json
        }))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Failed to run tests: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main() 