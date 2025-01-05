import anthropic

from typing import List, Dict, Optional
from dataclasses import dataclass
from abc import ABC, abstractmethod
from openai import OpenAI
from google import genai
from google.genai import types


@dataclass
class ModelInfo:
    name: str
    requires_api_key: bool
    available_models: List[str]
    description: str

class LLMImplementation(ABC):
    @abstractmethod
    def get_model_info(self) -> ModelInfo:
        pass
    
    @abstractmethod
    def generate_response(self, api_key: Optional[str], system_prompt:  Optional[str], user_prompt: str, model: str) -> str:
        pass

class OpenAIImplementation(LLMImplementation):
    def get_model_info(self) -> ModelInfo:
        return ModelInfo(
            name="OpenAI",
            requires_api_key=True,
            available_models=["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-3.5-turbo"],
            description="OpenAI's ChatGPT models"
        )
    
    def generate_response(self, api_key: Optional[str], system_prompt: Optional[str], user_prompt: str, model: str) -> str:
        if not api_key:
            raise ValueError("OpenAI requires an API key")
        
        client = OpenAI(api_key=api_key)

        messages = []
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        messages.append({
            "role": "user",
            "content": user_prompt
        })

        chat_completion = client.chat.completions.create(
            model=model,
            messages=messages
        )
        return chat_completion.choices[0].message.content

class AnthropicImplementation(LLMImplementation):
    def get_model_info(self) -> ModelInfo:
        return ModelInfo(
            name="Anthropic",
            requires_api_key=True,
            available_models=["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
            description="Anthropic's Claude models"
        )
    
    def generate_response(self, api_key: Optional[str], system_prompt: Optional[str], user_prompt: str, model: str) -> str:
        if not api_key:
            raise ValueError("Anthropic requires an API key")
        
        client = anthropic.Anthropic(api_key=api_key)

        kwargs = {
            "model": model,
            "max_tokens": 4096,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_prompt
                        }
                    ]
                }
            ]
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        message = client.messages.create(**kwargs)
        return message.content[0].text
    
class GeminiImplementation(LLMImplementation):
    def get_model_info(self) -> ModelInfo:
        return ModelInfo(
            name="Google AI",
            requires_api_key=True,
            available_models=["gemini-2.0-flash-exp", "gemini-exp-1206", "gemini-2.0-flash-thinking-exp-1219", "learnlm-1.5-pro-experimental","gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b"],
            description="Google's AI models"
        )
    
    def generate_response(self, api_key: Optional[str], system_prompt: Optional[str], user_prompt: str, model: str) -> str:
        if not api_key:
            raise ValueError("Google AI requires an API key")
            
        client = genai.Client(api_key=api_key)
        
        config = types.GenerateContentConfig(
            temperature=0
        )
        
        if system_prompt:
            config.system_instruction = system_prompt
            
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=config
        )
        
        return response.text
    
class LocalLLMImplementation(LLMImplementation):
    def get_model_info(self) -> ModelInfo:
        return ModelInfo(
            name="LocalLLM",
            requires_api_key=False,
            available_models=["llama2-7b", "mistral-7b"],
            description="Locally hosted models"
        )
    
    def generate_response(self, api_key: Optional[str], system_prompt: str, user_prompt: str, model: str) -> str:
        return "Local LLM response"
    

def get_available_implementations() -> List[LLMImplementation]:
    """Returns a list of all available LLM implementations"""
    return [
        OpenAIImplementation(),
        AnthropicImplementation(),
        GeminiImplementation()
    ]

def get_models_config() -> List[Dict]:
    """Returns configuration for all available models in a format suitable for the frontend"""
    implementations = get_available_implementations()
    return [
        {
            "name": impl.get_model_info().name,
            "requires_api_key": impl.get_model_info().requires_api_key,
            "available_models": impl.get_model_info().available_models,
            "description": impl.get_model_info().description
        }
        for impl in implementations
    ]

def generate_model_response(implementation_name: str, api_key: Optional[str], system_prompt: str, user_prompt: str, model: str) -> str:
    """Generate a response using the specified implementation and model"""
    implementations = {impl.get_model_info().name: impl for impl in get_available_implementations()}
    
    if implementation_name not in implementations:
        raise ValueError(f"Unknown implementation: {implementation_name}")
    
    implementation = implementations[implementation_name]
    return implementation.generate_response(api_key, system_prompt, user_prompt, model)
