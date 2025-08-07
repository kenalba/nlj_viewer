"""
Elasticsearch Service for Learning Analytics.
Direct integration with Elasticsearch for advanced analytics queries and aggregations.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass

try:
    from elasticsearch import AsyncElasticsearch
    from elasticsearch.exceptions import ConnectionError, NotFoundError, RequestError
    ELASTICSEARCH_AVAILABLE = True
except ImportError:
    ELASTICSEARCH_AVAILABLE = False
    AsyncElasticsearch = None
    ConnectionError = Exception
    NotFoundError = Exception
    RequestError = Exception

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class LearnerAnalytics:
    """Learner analytics data structure"""
    learner_email: str
    learner_name: str
    total_activities: int
    completed_activities: int
    completion_rate: float
    average_score: Optional[float]
    total_time_spent: Optional[int]  # minutes
    learning_streak: int  # consecutive days
    recent_activities: List[Dict[str, Any]]
    progress_by_program: Dict[str, Any]


@dataclass
class ActivityAnalytics:
    """Activity analytics data structure"""
    activity_id: str
    activity_name: str
    activity_type: str
    total_attempts: int
    unique_learners: int
    completion_rate: float
    average_score: Optional[float]
    average_time_spent: Optional[int]  # minutes
    difficulty_score: Optional[float]  # 0-1 based on success rates
    engagement_score: Optional[float]  # 0-1 based on interaction patterns


class ElasticsearchService:
    """Service for Elasticsearch-based learning analytics"""
    
    def __init__(self):
        if not ELASTICSEARCH_AVAILABLE:
            logger.warning("Elasticsearch client not available. Install elasticsearch-py package.")
            self._client = None
            return
            
        self.elasticsearch_url = settings.ELASTICSEARCH_URL or "http://elasticsearch:9200"
        self.index_name = settings.ELASTICSEARCH_INDEX or "nlj-xapi-statements"
        self._client = None
    
    async def _get_client(self) -> Optional[AsyncElasticsearch]:
        """Get or create Elasticsearch async client"""
        if not ELASTICSEARCH_AVAILABLE:
            return None
            
        if self._client is None:
            self._client = AsyncElasticsearch([self.elasticsearch_url])
        return self._client
    
    async def _safe_search(self, query: dict, empty_result: any = None) -> any:
        """Execute search with missing index handling"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")
        
        try:
            return await client.search(index=self.index_name, body=query)
        except NotFoundError:
            logger.info(f"Index {self.index_name} not found - returning empty result")
            return empty_result
    
    async def close(self):
        """Close the Elasticsearch client"""
        if self._client:
            await self._client.close()
            self._client = None
    
    # ========================================================================
    # INDEX MANAGEMENT
    # ========================================================================
    
    async def create_xapi_index(self) -> Dict[str, Any]:
        """Create optimized index mapping for xAPI statements"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")
        
        # Analytics-optimized mapping for xAPI statements (Ralph LRS compatible)
        mapping = {
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "stored": {"type": "date"},
                    "version": {"type": "keyword"},
                    
                    # Actor mapping - ENABLED for analytics
                    "actor": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "objectType": {"type": "keyword"},
                            "name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                            "mbox": {"type": "keyword"},
                            "account": {
                                "properties": {
                                    "name": {"type": "keyword"},
                                    "homePage": {"type": "keyword"}
                                }
                            }
                        }
                    },
                    
                    # Verb mapping - ENABLED for analytics
                    "verb": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "id": {"type": "keyword"},
                            "display": {"type": "object", "enabled": False}
                        }
                    },
                    
                    # Object mapping - ENABLED for analytics
                    "object": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "objectType": {"type": "keyword"},
                            "id": {"type": "keyword"},
                            "definition": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "object", "enabled": False},
                                    "description": {"type": "object", "enabled": False},
                                    "type": {"type": "keyword"},
                                    "interactionType": {"type": "keyword"}
                                }
                            }
                        }
                    },
                    
                    # Result mapping - ENABLED for analytics
                    "result": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "completion": {"type": "boolean"},
                            "success": {"type": "boolean"},
                            "score": {
                                "type": "object",
                                "properties": {
                                    "scaled": {"type": "float"},
                                    "raw": {"type": "float"},
                                    "min": {"type": "float"},
                                    "max": {"type": "float"}
                                }
                            },
                            "duration": {"type": "keyword"},
                            "response": {"type": "text"}
                        }
                    },
                    
                    # Context mapping - ENABLED for analytics
                    "context": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "platform": {"type": "keyword"},
                            "language": {"type": "keyword"},
                            "extensions": {"type": "object", "enabled": False}
                        }
                    }
                }
            },
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "index": {
                    "refresh_interval": "30s"
                }
            }
        }
        
        try:
            response = await client.indices.create(
                index=self.index_name,
                body=mapping,
                ignore=400  # Ignore if index already exists
            )
            
            logger.info(f"Created/verified Elasticsearch index: {self.index_name}")
            return {"success": True, "index": self.index_name, "response": response}
            
        except Exception as e:
            logger.error(f"Error creating Elasticsearch index: {str(e)}")
            raise
    
    async def delete_index(self) -> Dict[str, Any]:
        """Delete the xAPI statements index (use with caution!)"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")
        
        try:
            response = await client.indices.delete(
                index=self.index_name,
                ignore=404  # Ignore if index doesn't exist
            )
            
            logger.info(f"Deleted Elasticsearch index: {self.index_name}")
            return {"success": True, "index": self.index_name, "response": response}
            
        except Exception as e:
            logger.error(f"Error deleting Elasticsearch index: {str(e)}")
            raise
    
    # ========================================================================
    # LEARNER ANALYTICS
    # ========================================================================
    
    async def get_learner_analytics(
        self,
        learner_email: str,
        since: Optional[str] = None
    ) -> LearnerAnalytics:
        """Get comprehensive analytics for a specific learner"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")
        
        # Build query filters
        query_filter = [
            {"term": {"actor.mbox": f"mailto:{learner_email}"}}
        ]
        
        if since:
            query_filter.append({
                "range": {"timestamp": {"gte": since}}
            })
        
        # Main analytics query
        query = {
            "size": 0,  # We only want aggregations
            "query": {
                "bool": {"filter": query_filter}
            },
            "aggs": {
                # Total activities count
                "total_activities": {
                    "cardinality": {"field": "object.id"}
                },
                
                # Completed activities
                "completed_activities": {
                    "filter": {
                        "bool": {
                            "should": [
                                {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                {"term": {"result.completion": True}}
                            ]
                        }
                    },
                    "aggs": {
                        "unique_completed": {
                            "cardinality": {"field": "object.id"}
                        }
                    }
                },
                
                # Average score
                "average_score": {
                    "avg": {"field": "result.score.scaled"}
                },
                
                # Activity timeline for streak calculation
                "daily_activity": {
                    "date_histogram": {
                        "field": "timestamp",
                        "calendar_interval": "day",
                        "min_doc_count": 1
                    }
                },
                
                # Recent activities
                "recent_activities": {
                    "top_hits": {
                        "sort": [{"timestamp": {"order": "desc"}}],
                        "size": 10,
                        "_source": {
                            "includes": [
                                "object.id",
                                "object.definition.name",
                                "verb.id",
                                "result",
                                "timestamp"
                            ]
                        }
                    }
                },
                
                # Progress by program (using context extensions)
                "programs": {
                    "terms": {
                        "field": "context.extensions.http://nlj\\.platform/extensions/program_id",
                        "size": 20
                    },
                    "aggs": {
                        "program_completion": {
                            "filter": {
                                "bool": {
                                    "should": [
                                        {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                        {"term": {"result.completion": True}}
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        }
        
        try:
            response = await client.search(
                index=self.index_name,
                body=query
            )
            
            aggs = response["aggregations"]
            
            # Extract data
            total_activities = aggs["total_activities"]["value"]
            completed_activities = aggs["completed_activities"]["unique_completed"]["value"]
            completion_rate = (completed_activities / total_activities * 100) if total_activities > 0 else 0
            average_score = aggs["average_score"]["value"]
            
            # Calculate learning streak
            daily_buckets = aggs["daily_activity"]["buckets"]
            learning_streak = self._calculate_learning_streak(daily_buckets)
            
            # Process recent activities
            recent_hits = aggs["recent_activities"]["hits"]["hits"]
            recent_activities = [hit["_source"] for hit in recent_hits]
            
            # Process program progress
            program_buckets = aggs["programs"]["buckets"]
            progress_by_program = {}
            for bucket in program_buckets:
                program_id = bucket["key"]
                total_program_activities = bucket["doc_count"]
                completed_program_activities = bucket["program_completion"]["doc_count"]
                progress_by_program[program_id] = {
                    "total": total_program_activities,
                    "completed": completed_program_activities,
                    "completion_rate": (completed_program_activities / total_program_activities * 100) if total_program_activities > 0 else 0
                }
            
            # Get learner name from recent activity
            learner_name = "Unknown"
            if recent_activities:
                # Try to get name from a recent statement
                for activity in recent_activities:
                    # In a real implementation, you'd query for the actor name
                    # For now, we'll extract from email
                    learner_name = learner_email.split('@')[0].title()
                    break
            
            return LearnerAnalytics(
                learner_email=learner_email,
                learner_name=learner_name,
                total_activities=total_activities,
                completed_activities=completed_activities,
                completion_rate=round(completion_rate, 2),
                average_score=round(average_score, 3) if average_score else None,
                total_time_spent=None,  # Would need duration parsing
                learning_streak=learning_streak,
                recent_activities=recent_activities,
                progress_by_program=progress_by_program
            )
            
        except NotFoundError:
            # Index doesn't exist yet - return empty learner analytics
            logger.info(f"Index {self.index_name} not found - returning empty learner analytics")
            return LearnerAnalytics(
                learner_email=learner_email,
                learner_name=learner_email.split('@')[0].title(),
                total_activities=0,
                completed_activities=0,
                completion_rate=0.0,
                average_score=None,
                total_time_spent=0,
                learning_streak=0,
                recent_activities=[],
                progress_by_program={}
            )
        except Exception as e:
            logger.error(f"Error getting learner analytics for {learner_email}: {str(e)}")
            raise
    
    async def get_activity_analytics(
        self,
        activity_id: str,
        since: Optional[str] = None
    ) -> ActivityAnalytics:
        """Get comprehensive analytics for a specific activity"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")
        
        # Build query filters
        query_filter = [
            {"term": {"object.id": activity_id}}
        ]
        
        if since:
            query_filter.append({
                "range": {"timestamp": {"gte": since}}
            })
        
        query = {
            "size": 1,  # Get one doc for activity details
            "query": {
                "bool": {"filter": query_filter}
            },
            "aggs": {
                "unique_learners": {
                    "cardinality": {"field": "actor.mbox"}
                },
                "completed_attempts": {
                    "filter": {
                        "bool": {
                            "should": [
                                {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                {"term": {"result.completion": True}}
                            ]
                        }
                    }
                },
                "successful_attempts": {
                    "filter": {"term": {"result.success": True}}
                },
                "average_score": {
                    "avg": {"field": "result.score.scaled"}
                },
                "score_distribution": {
                    "histogram": {
                        "field": "result.score.scaled",
                        "interval": 0.1,
                        "min_doc_count": 1
                    }
                }
            }
        }
        
        try:
            response = await client.search(
                index=self.index_name,
                body=query
            )
            
            hits = response["hits"]["hits"]
            aggs = response["aggregations"]
            
            # Extract activity details
            activity_name = "Unknown Activity"
            activity_type = "unknown"
            
            if hits:
                obj_def = hits[0]["_source"].get("object", {}).get("definition", {})
                activity_name = obj_def.get("name", {}).get("en-US", activity_name)
                activity_type = obj_def.get("type", activity_type)
            
            # Calculate metrics
            total_attempts = response["hits"]["total"]["value"]
            unique_learners = aggs["unique_learners"]["value"]
            completed_attempts = aggs["completed_attempts"]["doc_count"]
            successful_attempts = aggs["successful_attempts"]["doc_count"]
            
            completion_rate = (completed_attempts / total_attempts * 100) if total_attempts > 0 else 0
            success_rate = (successful_attempts / total_attempts * 100) if total_attempts > 0 else 0
            average_score = aggs["average_score"]["value"]
            
            # Calculate difficulty score (inverse of success rate)
            difficulty_score = (100 - success_rate) / 100 if success_rate is not None else None
            
            # Calculate engagement score based on attempt patterns
            engagement_score = min(unique_learners / max(total_attempts, 1), 1.0)
            
            return ActivityAnalytics(
                activity_id=activity_id,
                activity_name=activity_name,
                activity_type=activity_type,
                total_attempts=total_attempts,
                unique_learners=unique_learners,
                completion_rate=round(completion_rate, 2),
                average_score=round(average_score, 3) if average_score else None,
                average_time_spent=None,  # Would need duration parsing
                difficulty_score=round(difficulty_score, 3) if difficulty_score is not None else None,
                engagement_score=round(engagement_score, 3)
            )
            
        except Exception as e:
            logger.error(f"Error getting activity analytics for {activity_id}: {str(e)}")
            raise
    
    # ========================================================================
    # PLATFORM ANALYTICS
    # ========================================================================
    
    async def get_platform_overview(
        self,
        since: Optional[str] = None,
        until: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get platform-wide analytics overview"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")
        
        # Build date range filter
        query_filter = []
        if since or until:
            date_range = {}
            if since:
                date_range["gte"] = since
            if until:
                date_range["lte"] = until
            query_filter.append({"range": {"timestamp": date_range}})
        
        query = {
            "size": 0,
            "query": (
                {"bool": {"filter": query_filter}} if query_filter else {"match_all": {}}
            ),
            "aggs": {
                "total_statements": {
                    "value_count": {"field": "id"}
                },
                "unique_learners": {
                    "cardinality": {"field": "actor.mbox"}
                },
                "unique_activities": {
                    "cardinality": {"field": "object.id"}
                },
                "completion_rate": {
                    "filter": {
                        "bool": {
                            "should": [
                                {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                {"term": {"result.completion": True}}
                            ]
                        }
                    }
                },
                "average_score": {
                    "avg": {"field": "result.score.scaled"}
                },
                "activity_timeline": {
                    "date_histogram": {
                        "field": "timestamp",
                        "calendar_interval": "day",
                        "min_doc_count": 0
                    }
                },
                "top_verbs": {
                    "terms": {"field": "verb.id", "size": 10}
                },
                "activity_types": {
                    "terms": {"field": "object.definition.type", "size": 10}
                }
            }
        }
        
        try:
            response = await client.search(
                index=self.index_name,
                body=query
            )
            
            aggs = response["aggregations"]
            
            total_statements = aggs["total_statements"]["value"]
            completion_count = aggs["completion_rate"]["doc_count"]
            completion_rate = (completion_count / total_statements * 100) if total_statements > 0 else 0
            
            return {
                "total_statements": total_statements,
                "unique_learners": aggs["unique_learners"]["value"],
                "unique_activities": aggs["unique_activities"]["value"],
                "completion_rate": round(completion_rate, 2),
                "average_score": round(aggs["average_score"]["value"], 3) if aggs["average_score"]["value"] else None,
                "daily_activity": [
                    {
                        "date": bucket["key_as_string"],
                        "count": bucket["doc_count"]
                    }
                    for bucket in aggs["activity_timeline"]["buckets"]
                ],
                "top_verbs": [
                    {
                        "verb": bucket["key"],
                        "count": bucket["doc_count"]
                    }
                    for bucket in aggs["top_verbs"]["buckets"]
                ],
                "activity_types": [
                    {
                        "type": bucket["key"],
                        "count": bucket["doc_count"]
                    }
                    for bucket in aggs["activity_types"]["buckets"]
                ],
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
            
        except NotFoundError:
            # Index doesn't exist yet - return empty analytics
            logger.info(f"Index {self.index_name} not found - returning empty analytics")
            return {
                "total_statements": 0,
                "unique_learners": 0,
                "unique_activities": 0,
                "completion_rate": 0.0,
                "average_score": None,
                "daily_activity": [],
                "top_verbs": [],
                "activity_types": [],
                "generated_at": datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting platform overview: {str(e)}")
            raise
    
    # ========================================================================
    # HEALTH AND UTILITY METHODS
    # ========================================================================
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to Elasticsearch"""
        client = await self._get_client()
        if not client:
            return {
                "success": False,
                "status": "client_unavailable",
                "error": "Elasticsearch client not available. Install elasticsearch-py package.",
                "tested_at": datetime.now(timezone.utc).isoformat()
            }
        
        try:
            health = await client.cluster.health()
            
            return {
                "success": True,
                "status": "connected",
                "cluster_name": health.get("cluster_name"),
                "cluster_status": health.get("status"),
                "number_of_nodes": health.get("number_of_nodes"),
                "endpoint": self.elasticsearch_url,
                "index": self.index_name,
                "tested_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            error_msg = f"Elasticsearch connection error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "status": "connection_failed",
                "error": error_msg,
                "endpoint": self.elasticsearch_url,
                "tested_at": datetime.now(timezone.utc).isoformat()
            }
    
    def _calculate_learning_streak(self, daily_buckets: List[Dict]) -> int:
        """Calculate current learning streak from daily activity buckets"""
        if not daily_buckets:
            return 0
        
        # Sort buckets by date (most recent first)
        sorted_buckets = sorted(daily_buckets, key=lambda x: x["key"], reverse=True)
        
        streak = 0
        current_date = datetime.now(timezone.utc).date()
        
        for bucket in sorted_buckets:
            bucket_date = datetime.fromisoformat(bucket["key_as_string"].split('T')[0]).date()
            
            # Check if this date is consecutive
            expected_date = current_date - timedelta(days=streak)
            
            if bucket_date == expected_date:
                streak += 1
            else:
                break
        
        return streak


# Global Elasticsearch service instance
elasticsearch_service = ElasticsearchService()


# Dependency injection functions for FastAPI
async def get_elasticsearch_service() -> ElasticsearchService:
    """Get Elasticsearch service instance for dependency injection"""
    return elasticsearch_service