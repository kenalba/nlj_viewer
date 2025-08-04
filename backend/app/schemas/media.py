"""
Pydantic schemas for media API endpoints.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


class MediaBase(BaseModel):
    """Base schema for media items."""
    title: str = Field(..., description="Media title")
    description: Optional[str] = Field(None, description="Media description") 


class MediaGenerationRequest(BaseModel):
    """Schema for requesting media generation."""
    source_document_id: uuid.UUID = Field(..., description="Source document ID to generate from")
    media_type: str = Field("podcast", description="Type of media to generate")
    media_style: Optional[str] = Field("npr_interview", description="Style template for generation")
    selected_keywords: List[str] = Field(default_factory=list, description="Keywords to focus on")
    selected_objectives: List[str] = Field(default_factory=list, description="Learning objectives to include")
    generation_config: Optional[Dict[str, Any]] = Field(None, description="Additional generation parameters")
    voice_config: Optional[Dict[str, Any]] = Field(None, description="Voice settings for audio generation")


class MediaCreate(MediaBase):
    """Schema for creating media items."""
    media_type: str = Field(..., description="Type of media")
    source_document_id: uuid.UUID = Field(..., description="Source document ID")
    generation_prompt: Optional[str] = Field(None, description="Generation prompt used")
    selected_keywords: List[str] = Field(default_factory=list)
    selected_objectives: List[str] = Field(default_factory=list)
    generation_config: Optional[Dict[str, Any]] = Field(None)
    voice_config: Optional[Dict[str, Any]] = Field(None)


class MediaUpdate(BaseModel):
    """Schema for updating media metadata."""
    title: Optional[str] = Field(None, description="Updated title")
    description: Optional[str] = Field(None, description="Updated description")
    is_public: Optional[bool] = Field(None, description="Updated public visibility")


class MediaTranscriptUpdate(BaseModel):
    """Schema for updating media transcript."""
    transcript: str = Field(..., description="Updated transcript content")


class MediaSummary(BaseModel):
    """Summary schema for media item lists."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID = Field(..., description="Media ID")
    title: str = Field(..., description="Media title")
    description: Optional[str] = Field(None, description="Media description")
    media_type: str = Field(..., description="Media type")
    media_state: str = Field(..., description="Generation state")
    
    # Content info
    duration: Optional[int] = Field(None, description="Duration in seconds")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    mime_type: Optional[str] = Field(None, description="MIME type")
    
    # Source tracking
    source_document_id: uuid.UUID = Field(..., description="Source document ID")
    
    # Generation metadata
    media_style: Optional[str] = Field(None, description="Generation style used")
    selected_keywords: List[str] = Field(default_factory=list, description="Keywords selected")
    selected_objectives: List[str] = Field(default_factory=list, description="Objectives selected")
    
    # Usage stats
    play_count: int = Field(0, description="Number of plays/views")
    last_played_at: Optional[datetime] = Field(None, description="Last played timestamp")
    
    # Sharing
    is_public: bool = Field(False, description="Public visibility")
    
    # Generation tracking
    generation_start_time: Optional[datetime] = Field(None, description="Generation start time")
    generation_end_time: Optional[datetime] = Field(None, description="Generation end time")
    generation_error: Optional[str] = Field(None, description="Generation error message")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: uuid.UUID = Field(..., description="Creator user ID")
    
    @property
    def display_name(self) -> str:
        """Get display name for UI."""
        return self.title
    
    @property
    def is_completed(self) -> bool:
        """Check if generation is completed."""
        return self.media_state == "completed"
    
    @property
    def is_failed(self) -> bool:
        """Check if generation failed."""
        return self.media_state == "failed"
    
    @property
    def is_generating(self) -> bool:
        """Check if currently generating."""
        return self.media_state == "generating"
    
    @property
    def duration_formatted(self) -> str:
        """Get formatted duration (MM:SS)."""
        if not self.duration:
            return "00:00"
        minutes = self.duration // 60  
        seconds = self.duration % 60
        return f"{minutes:02d}:{seconds:02d}"
    
    @property
    def generation_time(self) -> Optional[float]:
        """Get generation time in seconds."""
        if self.generation_start_time and self.generation_end_time:
            delta = self.generation_end_time - self.generation_start_time
            return delta.total_seconds()
        return None


class MediaResponse(MediaSummary):
    """Full response schema for media items."""
    
    # Additional fields for detailed view
    transcript: Optional[str] = Field(None, description="Generated transcript")
    file_path: Optional[str] = Field(None, description="File storage path")
    generation_prompt: Optional[str] = Field(None, description="Original generation prompt")
    generation_config: Optional[Dict[str, Any]] = Field(None, description="Generation configuration")
    voice_config: Optional[Dict[str, Any]] = Field(None, description="Voice configuration")


class MediaWithSourceResponse(MediaResponse):
    """Media response with source document information."""
    source_document: Optional[Dict[str, Any]] = Field(None, description="Source document details")


class MediaListResponse(BaseModel):
    """Response schema for paginated media lists."""
    items: List[MediaSummary] = Field(..., description="List of media items")
    total: int = Field(..., description="Total number of items")
    limit: int = Field(..., description="Items per page")
    offset: int = Field(..., description="Number of items skipped")
    
    @property
    def has_more(self) -> bool:
        """Check if there are more items available."""
        return self.offset + len(self.items) < self.total


class MediaGenerationStatus(BaseModel):
    """Schema for media generation status updates."""
    media_id: uuid.UUID = Field(..., description="Media item ID")
    status: str = Field(..., description="Current generation status")
    progress: Optional[float] = Field(None, description="Progress percentage (0-100)")
    message: Optional[str] = Field(None, description="Status message")
    error: Optional[str] = Field(None, description="Error message if failed")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")


class MediaPlayRequest(BaseModel):
    """Schema for tracking media play events."""
    media_id: uuid.UUID = Field(..., description="Media item ID")
    play_duration: Optional[int] = Field(None, description="How long the media was played (seconds)")
    completed: bool = Field(False, description="Whether playback was completed")


class MediaShareResponse(BaseModel):
    """Response schema for media sharing."""
    share_token: str = Field(..., description="Share token for public access")
    share_url: str = Field(..., description="Complete share URL")
    qr_code_url: Optional[str] = Field(None, description="QR code image URL")
    expires_at: Optional[datetime] = Field(None, description="Token expiration time")


class PodcastScriptRequest(BaseModel):
    """Schema for generating podcast scripts."""
    source_document_id: uuid.UUID = Field(..., description="Source document to process")
    selected_keywords: List[str] = Field(default_factory=list, description="Keywords to emphasize")
    selected_objectives: List[str] = Field(default_factory=list, description="Learning objectives to cover")
    style: str = Field("npr_interview", description="Podcast style template")
    length_preference: str = Field("medium", description="Length preference: short, medium, long")
    conversation_depth: str = Field("balanced", description="Depth: surface, balanced, deep")


class PodcastScriptResponse(BaseModel):
    """Response schema for generated podcast scripts."""
    script: str = Field(..., description="Generated podcast script")
    estimated_duration: int = Field(..., description="Estimated audio duration in seconds")
    word_count: int = Field(..., description="Script word count")
    speaker_count: int = Field(..., description="Number of speakers in the script")
    key_topics: List[str] = Field(..., description="Key topics covered in the script")
    source_attribution: str = Field(..., description="Source attribution text")


class VoiceOption(BaseModel):
    """Schema for available voice options."""
    voice_id: str = Field(..., description="Voice identifier")
    name: str = Field(..., description="Voice display name")
    gender: str = Field(..., description="Voice gender")
    language: str = Field(..., description="Voice language")
    style: str = Field(..., description="Voice style (professional, conversational, etc.)")
    preview_url: Optional[str] = Field(None, description="Preview audio URL")


class AudioGenerationRequest(BaseModel):
    """Schema for generating audio from transcript."""
    transcript: str = Field(..., description="Transcript to convert to audio")
    voice_config: Dict[str, Any] = Field(..., description="Voice configuration")
    output_format: str = Field("mp3", description="Audio output format")
    quality: str = Field("high", description="Audio quality setting")


class AudioGenerationResponse(BaseModel):
    """Response schema for audio generation."""
    audio_url: str = Field(..., description="URL to generated audio file")
    duration: int = Field(..., description="Audio duration in seconds")
    file_size: int = Field(..., description="Audio file size in bytes")
    format: str = Field(..., description="Audio format")
    generation_time: float = Field(..., description="Time taken to generate audio")