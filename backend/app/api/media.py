"""
Media API endpoints for podcast and media generation.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.core.database_manager import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.media import MediaItem, MediaType, MediaState
from app.schemas.media import (
    MediaGenerationRequest,
    MediaResponse,
    MediaSummary,
    MediaListResponse,
    MediaUpdate,
    MediaTranscriptUpdate,
    MediaShareResponse,
    PodcastScriptRequest,
    PodcastScriptResponse,
    AudioGenerationRequest,
    AudioGenerationResponse,
    MediaGenerationStatus,
    MediaPlayRequest,
    VoiceOption
)
from app.services.media_service import media_service
from app.services.podcast_generation_service import podcast_generation_service
from app.services.shared_token_service import shared_token_service

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/generate-podcast", response_model=MediaResponse)
async def generate_podcast(
    request: MediaGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a podcast from a source document.
    This creates a media item and starts the generation process in the background.
    """
    try:
        # Create media item in GENERATING state
        media_item = await media_service.create_media_item(
            db=db,
            title=f"Podcast: {request.source_document_id}",  # Will be updated with better title
            media_type=MediaType.PODCAST,
            source_document_id=request.source_document_id,
            user_id=current_user.id,
            generation_config=request.generation_config,
            voice_config=request.voice_config,
            selected_keywords=request.selected_keywords,
            selected_objectives=request.selected_objectives,
            media_style=request.media_style
        )
        
        # Start generation process in background
        background_tasks.add_task(
            podcast_generation_service.generate_podcast_async,
            media_item.id,
            db
        )
        
        return MediaResponse.model_validate(media_item)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start podcast generation: {str(e)}")


@router.post("/generate-script", response_model=PodcastScriptResponse)
async def generate_podcast_script(
    request: PodcastScriptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a podcast script from a source document without creating audio.
    Useful for preview and editing before final generation.
    """
    try:
        script_data = await podcast_generation_service.generate_script_only(
            source_document_id=request.source_document_id,
            selected_keywords=request.selected_keywords,
            selected_objectives=request.selected_objectives,
            db=db,
            style=request.style,
            length_preference=request.length_preference,
            conversation_depth=request.conversation_depth
        )
        
        return PodcastScriptResponse(**script_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate script: {str(e)}")


@router.post("/generate-audio", response_model=AudioGenerationResponse)
async def generate_audio_from_transcript(
    request: AudioGenerationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate audio from a transcript using TTS.
    """
    try:
        audio_data = await podcast_generation_service.generate_audio_from_transcript(
            transcript=request.transcript,
            voice_config=request.voice_config,
            output_format=request.output_format,
            quality=request.quality
        )
        
        return AudioGenerationResponse(**audio_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate audio: {str(e)}")


@router.get("/voices", response_model=List[VoiceOption])
async def get_available_voices(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of available TTS voices.
    """
    try:
        voices = await podcast_generation_service.get_available_voices()
        return [VoiceOption(**voice) for voice in voices]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices: {str(e)}")


@router.get("", response_model=MediaListResponse)
async def get_user_media(
    search: Optional[str] = Query(None, description="Search in title and description"),
    media_type: Optional[str] = Query(None, description="Filter by media type"),
    media_state: Optional[str] = Query(None, description="Filter by generation state"),
    source_document_id: Optional[uuid.UUID] = Query(None, description="Filter by source document"),
    limit: int = Query(50, ge=1, le=100, description="Number of items to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's media items with filtering and pagination.
    """
    try:
        media_items, total_count = await media_service.get_user_media(
            db=db,
            user_id=current_user.id,
            search_query=search,
            media_type=media_type,
            media_state=media_state,
            source_document_id=source_document_id,
            limit=limit,
            offset=offset
        )
        
        return MediaListResponse(
            items=[MediaSummary.model_validate(item) for item in media_items],
            total=total_count,
            limit=limit,
            offset=offset
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch media: {str(e)}")


@router.get("/{media_id}", response_model=MediaResponse)
async def get_media_item(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific media item by ID.
    """
    media_item = await media_service.get_media_by_id(
        db=db,
        media_id=media_id,
        user_id=current_user.id
    )
    
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    return MediaResponse.model_validate(media_item)


@router.put("/{media_id}", response_model=MediaResponse)
async def update_media_item(
    media_id: uuid.UUID,
    update_data: MediaUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update media item metadata.
    """
    media_item = await media_service.update_media_metadata(
        db=db,
        media_id=media_id,
        user_id=current_user.id,
        **update_data.model_dump(exclude_unset=True)
    )
    
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    return MediaResponse.model_validate(media_item)


@router.put("/{media_id}/transcript", response_model=MediaResponse)
async def update_media_transcript(
    media_id: uuid.UUID,
    transcript_data: MediaTranscriptUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update media transcript and regenerate audio if needed.
    """
    media_item = await media_service.update_media_transcript(
        db=db,
        media_id=media_id,
        user_id=current_user.id,
        transcript=transcript_data.transcript
    )
    
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    return MediaResponse.model_validate(media_item)


@router.delete("/{media_id}")
async def delete_media_item(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a media item and its associated files.
    """
    success = await media_service.delete_media_item(
        db=db,
        media_id=media_id,
        user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    return {"message": "Media item deleted successfully"}


@router.post("/{media_id}/share", response_model=MediaShareResponse)
async def create_media_share(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a public share link for a media item.
    """
    media_item = await media_service.get_media_by_id(
        db=db,
        media_id=media_id,
        user_id=current_user.id
    )
    
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    if not media_item.can_be_shared():
        raise HTTPException(status_code=400, detail="Media item cannot be shared in its current state")
    
    try:
        share_data = await shared_token_service.create_media_share(
            db=db,
            media_id=media_id,
            user_id=current_user.id
        )
        
        return MediaShareResponse(**share_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create share: {str(e)}")


@router.get("/{media_id}/status", response_model=MediaGenerationStatus)
async def get_generation_status(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the current generation status of a media item.
    """
    media_item = await media_service.get_media_by_id(
        db=db,
        media_id=media_id,
        user_id=current_user.id
    )
    
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    return MediaGenerationStatus(
        media_id=media_item.id,
        status=media_item.media_state,
        message=media_item.generation_error if media_item.is_failed() else None,
        error=media_item.generation_error if media_item.is_failed() else None
    )


@router.post("/{media_id}/play")
async def track_media_play(
    media_id: uuid.UUID,
    play_data: MediaPlayRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Track media play event for analytics.
    """
    await media_service.track_media_play(
        db=db,
        media_id=media_id,
        user_id=current_user.id,
        play_duration=play_data.play_duration,
        completed=play_data.completed
    )
    
    return {"message": "Play event tracked"}


@router.get("/{media_id}/download")
async def download_media_file(
    media_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download the media file.
    """
    media_item = await media_service.get_media_by_id(
        db=db,
        media_id=media_id,
        user_id=current_user.id
    )
    
    if not media_item:
        raise HTTPException(status_code=404, detail="Media item not found")
    
    if not media_item.file_path:
        raise HTTPException(status_code=404, detail="Media file not available")
    
    # Check if file exists on disk
    if not os.path.exists(media_item.file_path):
        raise HTTPException(status_code=404, detail="Media file not found on disk")
    
    # Return the file directly
    return FileResponse(
        path=media_item.file_path,
        media_type="audio/mpeg",
        filename=f"{media_item.title}.mp3"
    )