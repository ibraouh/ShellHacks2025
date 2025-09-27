from abc import ABC, abstractmethod
from typing import Dict, Any
from pydantic import BaseModel

class ToolRequest(BaseModel):
    """Base request model for all tools"""
    pass

class ToolResponse(BaseModel):
    """Base response model for all tools"""
    success: bool
    message: str
    data: Dict[str, Any] = {}

class BaseTool(ABC):
    """Base class for all accessibility tools"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    @abstractmethod
    async def process(self, request: ToolRequest) -> ToolResponse:
        """Process the tool request and return a response"""
        pass
    
    def get_info(self) -> Dict[str, str]:
        """Get tool information"""
        return {
            "name": self.name,
            "description": self.description
        }
