#!/usr/bin/env python3
"""
Database seeding script for NLJ Platform development environment.
Creates basic users, sample content, and training programs for testing.
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

# Import all models
from app.models.user import User, UserRole
from app.models.content import ContentItem
from app.models.training_program import TrainingProgram, TrainingSession
from app.core.database_manager import db_manager, create_tables

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database connection now handled by database_manager

async def create_users(session: AsyncSession) -> Dict[str, User]:
    """Create basic users for all roles."""
    print("Creating users...")
    
    users = {}
    
    # Admin user
    admin_user = User(
        id=uuid.uuid4(),
        username="admin",
        email="admin@nlj-platform.com",
        hashed_password=pwd_context.hash("admin123456"),
        full_name="Administrator",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    users['admin'] = admin_user
    
    # Creator user
    creator_user = User(
        id=uuid.uuid4(),
        username="creator",
        email="creator@nlj-platform.com",
        hashed_password=pwd_context.hash("creator123"),
        full_name="Content Creator",
        role=UserRole.CREATOR,
        is_active=True,
        is_verified=True,
    )
    users['creator'] = creator_user
    
    # Reviewer user
    reviewer_user = User(
        id=uuid.uuid4(),
        username="reviewer",
        email="reviewer@nlj-platform.com",
        hashed_password=pwd_context.hash("reviewer123"),
        full_name="Content Reviewer",
        role=UserRole.REVIEWER,
        is_active=True,
        is_verified=True,
    )
    users['reviewer'] = reviewer_user
    
    # Player/Learner user
    player_user = User(
        id=uuid.uuid4(),
        username="player",
        email="player@nlj-platform.com",
        hashed_password=pwd_context.hash("player123"),
        full_name="Test Player",
        role=UserRole.PLAYER,
        is_active=True,
        is_verified=True,
    )
    users['player'] = player_user
    
    # Learner user (for training sessions)
    learner_user = User(
        id=uuid.uuid4(),
        username="learner",
        email="learner@nlj-platform.com",
        hashed_password=pwd_context.hash("learner123"),
        full_name="Training Learner",
        role=UserRole.LEARNER,
        is_active=True,
        is_verified=True,
    )
    users['learner'] = learner_user
    
    for user in users.values():
        session.add(user)
    
    await session.flush()
    print(f"Created {len(users)} users")
    return users

async def load_static_content(session: AsyncSession, users: Dict[str, User]) -> List[ContentItem]:
    """Load sample NLJ content from static files."""
    print("Loading static content files...")
    
    content_items = []
    
    # Path to sample content - check multiple possible locations
    possible_paths = [
        Path(__file__).parent.parent.parent / "static" / "sample_nljs",
        Path(__file__).parent.parent.parent / "frontend" / "public" / "static" / "sample_nljs",
        Path(__file__).parent.parent.parent / "frontend" / "static" / "sample_nljs"
    ]
    
    sample_dir = None
    for path in possible_paths:
        if path.exists():
            sample_dir = path
            break
    
    if not sample_dir:
        print(f"⚠️  Static content directory not found. Using hardcoded samples instead.")
        return await create_sample_content(session, users)
    
    print(f"📁 Loading content from: {sample_dir}")
    
    try:
        for json_file in sample_dir.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    nlj_data = json.load(f)
                
                # Create content item from loaded NLJ data
                content_item = ContentItem(
                    id=uuid.uuid4(),
                    title=nlj_data.get('name', json_file.stem),
                    description=f"Loaded from {json_file.name}",
                    content_type="scenario",
                    learning_style="interactive",
                    tags=["sample", "static-content"],
                    nlj_data=nlj_data,
                    state="published",
                    is_active=True,
                    created_by_id=users['creator'].id,
                    updated_by_id=users['creator'].id
                )
                
                content_items.append(content_item)
                session.add(content_item)
                print(f"  ✅ Loaded: {content_item.title}")
                
            except Exception as e:
                print(f"  ❌ Failed to load {json_file.name}: {e}")
    
    except Exception as e:
        print(f"❌ Error loading static content: {e}")
        return await create_sample_content(session, users)
    
    await session.flush()
    print(f"📚 Loaded {len(content_items)} content items from static files")
    return content_items

async def create_sample_content(session: AsyncSession, users: Dict[str, User]) -> List[ContentItem]:
    """Create sample content items from existing NLJ scenarios."""
    print("Creating sample content...")
    
    content_items = []
    
    # Sample NLJ scenarios to load
    sample_scenarios = [
        {
            "title": "FSA Product Knowledge Assessment",
            "description": "Interactive assessment covering Financial Services Advisor product knowledge and customer interaction scenarios.",
            "content_type": "assessment",
            "learning_style": "interactive",
            "tags": ["finance", "assessment", "product-knowledge"],
            "learning_objectives": [
                "Identify key features of financial products",
                "Demonstrate understanding of customer needs assessment",
                "Apply product knowledge in customer scenarios"
            ],
            "nlj_data": {
                "id": "fsa-product-knowledge",
                "name": "FSA Product Knowledge Assessment",
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "x": 100,
                        "y": 100,
                        "data": {
                            "title": "Welcome to Product Knowledge Assessment",
                            "content": "Test your knowledge of our financial products and customer service skills."
                        }
                    },
                    {
                        "id": "q1",
                        "type": "multiple_choice",
                        "x": 300,
                        "y": 100,
                        "data": {
                            "title": "Investment Products",
                            "content": "Which investment product is most suitable for a risk-averse client approaching retirement?",
                            "choices": [
                                {"id": "a", "text": "High-growth equity funds", "isCorrect": False},
                                {"id": "b", "text": "Conservative bond portfolio", "isCorrect": True},
                                {"id": "c", "text": "Cryptocurrency investments", "isCorrect": False},
                                {"id": "d", "text": "Emerging market funds", "isCorrect": False}
                            ],
                            "feedback": {
                                "correct": "Excellent! Conservative bond portfolios provide steady income with lower risk.",
                                "incorrect": "Consider the client's risk tolerance and retirement timeline."
                            }
                        }
                    },
                    {
                        "id": "end",
                        "type": "end",
                        "x": 500,
                        "y": 100,
                        "data": {
                            "title": "Assessment Complete",
                            "content": "Thank you for completing the product knowledge assessment."
                        }
                    }
                ],
                "links": [
                    {"id": "start-q1", "sourceNodeId": "start", "targetNodeId": "q1"},
                    {"id": "q1-end", "sourceNodeId": "q1", "targetNodeId": "end"}
                ]
            }
        },
        {
            "title": "Customer Service Excellence Training",
            "description": "Interactive training module covering best practices in customer service and conflict resolution.",
            "content_type": "training",
            "learning_style": "scenario-based",
            "tags": ["customer-service", "training", "communication"],
            "learning_objectives": [
                "Apply active listening techniques",
                "Handle customer complaints professionally",
                "Use de-escalation strategies effectively"
            ],
            "nlj_data": {
                "id": "customer-service-training",
                "name": "Customer Service Excellence Training",
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "x": 100,
                        "y": 100,
                        "data": {
                            "title": "Customer Service Training",
                            "content": "Learn essential skills for providing exceptional customer service."
                        }
                    },
                    {
                        "id": "scenario1",
                        "type": "true_false",
                        "x": 300,
                        "y": 100,
                        "data": {
                            "title": "Active Listening",
                            "content": "A customer calls to complain about a service issue. The best first step is to immediately offer a solution.",
                            "correctAnswer": False,
                            "feedback": {
                                "correct": "Correct! Listen first to fully understand the customer's concern before offering solutions.",
                                "incorrect": "Actually, the best first step is to listen carefully and acknowledge their concern."
                            }
                        }
                    },
                    {
                        "id": "end",
                        "type": "end",
                        "x": 500,
                        "y": 100,
                        "data": {
                            "title": "Training Complete",
                            "content": "You've completed the customer service excellence training."
                        }
                    }
                ],
                "links": [
                    {"id": "start-scenario1", "sourceNodeId": "start", "targetNodeId": "scenario1"},
                    {"id": "scenario1-end", "sourceNodeId": "scenario1", "targetNodeId": "end"}
                ]
            }
        },
        {
            "title": "Word Connections Game",
            "description": "NYT-style word puzzle game to test vocabulary and pattern recognition skills.",
            "content_type": "game",
            "learning_style": "gamified",
            "tags": ["vocabulary", "puzzle", "critical-thinking"],
            "learning_objectives": [
                "Identify word patterns and relationships",
                "Develop analytical thinking skills",
                "Improve vocabulary recognition"
            ],
            "nlj_data": {
                "id": "word-connections-game",
                "name": "Word Connections Game",
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "x": 100,
                        "y": 100,
                        "data": {
                            "title": "Word Connections",
                            "content": "Find groups of 4 related words. Each group has a specific theme or connection."
                        }
                    },
                    {
                        "id": "game1",
                        "type": "connections",
                        "x": 300,
                        "y": 100,
                        "data": {
                            "title": "Financial Terms Connections",
                            "content": "Group these financial terms by category:",
                            "words": [
                                "BOND", "STOCK", "CASH", "FUND",
                                "BULL", "BEAR", "STAG", "DOVE",
                                "LOAN", "DEBT", "CREDIT", "MORTGAGE",
                                "YIELD", "RETURN", "PROFIT", "GAIN"
                            ],
                            "categories": [
                                {
                                    "name": "INVESTMENT TYPES",
                                    "words": ["BOND", "STOCK", "CASH", "FUND"],
                                    "difficulty": 1
                                },
                                {
                                    "name": "MARKET ANIMALS",
                                    "words": ["BULL", "BEAR", "STAG", "DOVE"],
                                    "difficulty": 2
                                },
                                {
                                    "name": "BORROWING TERMS",
                                    "words": ["LOAN", "DEBT", "CREDIT", "MORTGAGE"],
                                    "difficulty": 3
                                },
                                {
                                    "name": "EARNINGS SYNONYMS",
                                    "words": ["YIELD", "RETURN", "PROFIT", "GAIN"],
                                    "difficulty": 4
                                }
                            ]
                        }
                    },
                    {
                        "id": "end",
                        "type": "end",
                        "x": 500,
                        "y": 100,
                        "data": {
                            "title": "Game Complete",
                            "content": "Great job solving the word connections puzzle!"
                        }
                    }
                ],
                "links": [
                    {"id": "start-game1", "sourceNodeId": "start", "targetNodeId": "game1"},
                    {"id": "game1-end", "sourceNodeId": "game1", "targetNodeId": "end"}
                ]
            }
        },
        {
            "title": "Employee Satisfaction Survey",
            "description": "Comprehensive survey to assess employee satisfaction and engagement levels.",
            "content_type": "survey",
            "learning_style": "reflective",
            "tags": ["hr", "employee-engagement", "feedback"],
            "learning_objectives": [
                "Provide honest feedback about workplace experience",
                "Identify areas for organizational improvement",
                "Contribute to company culture assessment"
            ],
            "nlj_data": {
                "id": "employee-satisfaction-survey",
                "name": "Employee Satisfaction Survey",
                "nodes": [
                    {
                        "id": "start",
                        "type": "start",
                        "x": 100,
                        "y": 100,
                        "data": {
                            "title": "Employee Satisfaction Survey",
                            "content": "Your feedback helps us improve our workplace. All responses are confidential."
                        }
                    },
                    {
                        "id": "q1",
                        "type": "likert_scale",
                        "x": 300,
                        "y": 100,
                        "data": {
                            "title": "Job Satisfaction",
                            "content": "Overall, how satisfied are you with your current job?",
                            "scale": {
                                "min": 1,
                                "max": 5,
                                "labels": {
                                    "1": "Very Dissatisfied",
                                    "2": "Dissatisfied", 
                                    "3": "Neutral",
                                    "4": "Satisfied",
                                    "5": "Very Satisfied"
                                }
                            }
                        }
                    },
                    {
                        "id": "q2",
                        "type": "text_area",
                        "x": 500,
                        "y": 100,
                        "data": {
                            "title": "Suggestions",
                            "content": "What suggestions do you have for improving our workplace?",
                            "placeholder": "Please share your thoughts and suggestions...",
                            "maxLength": 500
                        }
                    },
                    {
                        "id": "end",
                        "type": "end",
                        "x": 700,
                        "y": 100,
                        "data": {
                            "title": "Survey Complete",
                            "content": "Thank you for your valuable feedback!"
                        }
                    }
                ],
                "links": [
                    {"id": "start-q1", "sourceNodeId": "start", "targetNodeId": "q1"},
                    {"id": "q1-q2", "sourceNodeId": "q1", "targetNodeId": "q2"},
                    {"id": "q2-end", "sourceNodeId": "q2", "targetNodeId": "end"}
                ]
            }
        }
    ]
    
    for i, scenario_data in enumerate(sample_scenarios):
        content_item = ContentItem(
            id=uuid.uuid4(),
            title=scenario_data["title"],
            description=scenario_data["description"],
            content_type=scenario_data["content_type"],
            learning_style=scenario_data["learning_style"],
            difficulty_level="intermediate",
            estimated_duration=15 + (i * 5),  # 15, 20, 25, 30 minutes
            tags=scenario_data["tags"],
            learning_objectives=scenario_data["learning_objectives"],
            is_template=False,
            template_category="Sample Content",
            nlj_data=scenario_data["nlj_data"],
            state="published",
            version=1,
            creator_id=users["admin"].id,
            published_at=datetime.utcnow()
        )
        content_items.append(content_item)
        session.add(content_item)
    
    await session.flush()
    print(f"Created {len(content_items)} sample content items")
    return content_items

async def create_training_programs(session: AsyncSession, users: Dict[str, User]) -> List[TrainingProgram]:
    """Create sample training programs."""
    print("Creating training programs...")
    
    programs = []
    
    # Financial Services Training Program
    financial_program = TrainingProgram(
        id=uuid.uuid4(),
        title="Financial Services Advisor Certification",
        description="Comprehensive training program covering all aspects of financial services advising, including product knowledge, customer service, and regulatory compliance.",
        duration_minutes=240,  # 4 hours
        prerequisites=["Basic finance knowledge", "Customer service experience"],
        learning_objectives=[
            "Master financial product features and benefits",
            "Demonstrate professional customer interaction skills",
            "Apply regulatory compliance in daily activities",
            "Develop effective sales presentation techniques"
        ],
        instructor_requirements={
            "certifications": ["CFP", "Series 7"],
            "experience_years": 5,
            "specialties": ["Investment Planning", "Customer Relations"]
        },
        requires_approval=True,
        auto_approve=False,
        allow_waitlist=True,
        is_published=True,
        created_by_id=users["admin"].id
    )
    programs.append(financial_program)
    
    # Customer Service Excellence Program
    service_program = TrainingProgram(
        id=uuid.uuid4(),
        title="Customer Service Excellence Workshop",
        description="Interactive workshop focusing on advanced customer service techniques, conflict resolution, and customer retention strategies.",
        duration_minutes=180,  # 3 hours
        prerequisites=["Basic customer service experience"],
        learning_objectives=[
            "Master active listening techniques",
            "Handle difficult customer situations with confidence",
            "Use de-escalation strategies effectively",
            "Build long-term customer relationships"
        ],
        instructor_requirements={
            "certifications": ["Customer Service Professional"],
            "experience_years": 3,
            "specialties": ["Conflict Resolution", "Communication"]
        },
        requires_approval=False,
        auto_approve=True,
        allow_waitlist=True,
        is_published=True,
        created_by_id=users["creator"].id
    )
    programs.append(service_program)
    
    # Leadership Development Program
    leadership_program = TrainingProgram(
        id=uuid.uuid4(),
        title="Emerging Leaders Development Program",
        description="Comprehensive leadership development program designed for high-potential employees ready to take on leadership roles.",
        duration_minutes=360,  # 6 hours
        prerequisites=["2+ years management experience", "Supervisor recommendation"],
        learning_objectives=[
            "Develop strategic thinking capabilities",
            "Build effective team management skills",
            "Learn to coach and mentor team members",
            "Master change management principles"
        ],
        instructor_requirements={
            "certifications": ["Leadership Development Specialist"],
            "experience_years": 7,
            "specialties": ["Executive Coaching", "Team Development"]
        },
        requires_approval=True,
        auto_approve=False,
        allow_waitlist=False,
        is_published=True,
        created_by_id=users["admin"].id
    )
    programs.append(leadership_program)
    
    for program in programs:
        session.add(program)
    
    await session.flush()
    print(f"Created {len(programs)} training programs")
    return programs

async def create_training_sessions(session: AsyncSession, programs: List[TrainingProgram], users: Dict[str, User]) -> List[TrainingSession]:
    """Create sample training sessions."""
    print("Creating training sessions...")
    
    sessions = []
    locations = [
        "Corporate Headquarters - Main Training Room",
        "Training Center North - Room 101",
        "Virtual/Online Session"
    ]
    
    # Create sessions for each program
    for i, program in enumerate(programs):
        # Create 2-3 sessions per program with different times
        base_date = datetime.utcnow() + timedelta(days=7 + (i * 3))
        
        for j in range(2 if i == 2 else 3):  # Leadership program gets fewer sessions
            session_start = base_date + timedelta(days=j * 14, hours=9)  # Every 2 weeks at 9 AM
            session_end = session_start + timedelta(minutes=program.duration_minutes)
            
            training_session = TrainingSession(
                id=uuid.uuid4(),
                program_id=program.id,
                start_time=session_start,
                end_time=session_end,
                location=locations[j % len(locations)],
                capacity=20 if program.title != "Emerging Leaders Development Program" else 12,
                buffer_time_minutes=15,
                instructor_id=users["creator"].id if j % 2 == 0 else users["reviewer"].id,
                status="scheduled",
                notes=f"Session {j + 1} for {program.title}"
            )
            sessions.append(training_session)
            session.add(training_session)
    
    await session.flush()
    print(f"Created {len(sessions)} training sessions")
    return sessions

async def seed_database():
    """Main function to seed the database with all sample data."""
    print("Starting database seeding...")
    print("🔍 Detecting database configuration...")
    
    # Initialize database manager (handles both RDS and direct PostgreSQL)
    await db_manager.initialize()
    
    # Create tables if they don't exist
    await create_tables()
    
    connection_info = db_manager.get_connection_info()
    print(f"📊 Connected to: {'RDS' if connection_info.get('use_rds') else 'Direct PostgreSQL'}")
    print(f"🔗 Database: {connection_info.get('url', 'Unknown')}")
    
    async with db_manager.get_session() as session:
        try:
            # Create all sample data
            users = await create_users(session)
            content_items = await load_static_content(session, users)
            programs = await create_training_programs(session, users)
            training_sessions = await create_training_sessions(session, programs, users)
            
            # Commit all changes
            await session.commit()
            
            print("\n" + "="*50)
            print("DATABASE SEEDING COMPLETE!")
            print("="*50)
            print("\nCreated Users:")
            for role, user in users.items():
                print(f"  • {user.full_name} ({role}) - {user.username} / {role}123{'456' if role == 'admin' else ''}")
            
            print(f"\nCreated Content Items: {len(content_items)}")
            for item in content_items:
                print(f"  • {item.title} ({item.content_type})")
            
            print(f"\nCreated Training Programs: {len(programs)}")
            for program in programs:
                print(f"  • {program.title} ({program.duration_minutes} min)")
            
            print(f"\nCreated Training Sessions: {len(training_sessions)}")
            print("\nDevelopment environment is ready!")
            print("\nLogin credentials:")
            print("  Admin: admin / admin123456")
            print("  Creator: creator / creator123")
            print("  Reviewer: reviewer / reviewer123")
            print("  Player: player / player123")
            print("  Learner: learner / learner123")
            
        except Exception as e:
            print(f"Error seeding database: {e}")
            await session.rollback()
            raise
        finally:
            await db_manager.close()

if __name__ == "__main__":
    asyncio.run(seed_database())