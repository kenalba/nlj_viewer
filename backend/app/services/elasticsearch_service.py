"""
Enhanced Elasticsearch Service for FastStream Migration.
Direct Elasticsearch integration that replaces Ralph LRS while maintaining all analytics capabilities.
Includes xAPI statement storage with validation for FastStream event processing.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

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
    """
    Enhanced Elasticsearch service that replaces Ralph LRS.
    Provides direct Elasticsearch integration with all Ralph LRS capabilities plus xAPI validation.
    """

    def __init__(self):
        if not ELASTICSEARCH_AVAILABLE:
            logger.warning("Elasticsearch client not available. Install elasticsearch-py package.")
            self._client = None
            return

        self.elasticsearch_url = settings.ELASTICSEARCH_URL or "http://elasticsearch:9200"
        self.index_name = settings.ELASTICSEARCH_INDEX or "xapi-statements"
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
    # xAPI STATEMENT STORAGE (NEW - REPLACES RALPH LRS)
    # ========================================================================

    async def store_xapi_statement(self, statement: Dict[str, Any], index_suffix: Optional[str] = None) -> Dict[str, Any]:
        """
        Store xAPI statement with validation and optional node-specific indexing.
        Replaces Ralph LRS storage with direct Elasticsearch integration.
        
        Args:
            statement: xAPI statement dictionary
            index_suffix: Optional suffix for node-specific indexing (e.g., 'node-123')
        """
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")

        try:
            # Ensure statement has required fields
            if "id" not in statement:
                statement["id"] = str(uuid4())

            if "timestamp" not in statement:
                statement["timestamp"] = datetime.now(timezone.utc).isoformat()

            if "version" not in statement:
                statement["version"] = "1.0.3"

            # Add stored timestamp for Ralph LRS compatibility
            statement["stored"] = datetime.now(timezone.utc).isoformat()

            # Determine target index
            target_index = self.index_name
            if index_suffix:
                target_index = f"{self.index_name}-{index_suffix}"
                # Ensure node-specific index exists
                await self._ensure_node_index(target_index)

            # Store in Elasticsearch
            response = await client.index(
                index=target_index,
                id=statement["id"],
                body=statement
            )

            logger.info(f"Stored xAPI statement {statement['id']} in Elasticsearch index {target_index}")

            return {
                "success": True,
                "statement_id": statement["id"],
                "stored_at": statement["stored"],
                "target_index": target_index,
                "response": response,
            }

        except Exception as e:
            error_msg = f"Error storing xAPI statement: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def store_xapi_statements(self, statements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Store multiple xAPI statements using bulk operations"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")

        try:
            # Process each statement
            processed_statements = []
            for statement in statements:
                if "id" not in statement:
                    statement["id"] = str(uuid4())

                if "timestamp" not in statement:
                    statement["timestamp"] = datetime.now(timezone.utc).isoformat()

                if "version" not in statement:
                    statement["version"] = "1.0.3"

                statement["stored"] = datetime.now(timezone.utc).isoformat()
                processed_statements.append(statement)

            # Prepare bulk operations
            bulk_operations = []
            for statement in processed_statements:
                bulk_operations.extend([
                    {"index": {"_index": self.index_name, "_id": statement["id"]}},
                    statement
                ])

            # Execute bulk operation
            response = await client.bulk(body=bulk_operations)

            statement_ids = [stmt["id"] for stmt in processed_statements]
            logger.info(f"Bulk stored {len(processed_statements)} xAPI statements: {statement_ids}")

            return {
                "success": True,
                "statement_count": len(processed_statements),
                "statement_ids": statement_ids,
                "stored_at": datetime.now(timezone.utc).isoformat(),
                "response": response,
            }

        except Exception as e:
            error_msg = f"Error bulk storing xAPI statements: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

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
                            "account": {"properties": {"name": {"type": "keyword"}, "homePage": {"type": "keyword"}}},
                        },
                    },
                    # Verb mapping - ENABLED for analytics
                    "verb": {
                        "type": "object",
                        "enabled": True,
                        "properties": {"id": {"type": "keyword"}, "display": {"type": "object", "enabled": False}},
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
                                    "interactionType": {"type": "keyword"},
                                },
                            },
                        },
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
                                    "max": {"type": "float"},
                                },
                            },
                            "duration": {"type": "keyword"},
                            "response": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                        },
                    },
                    # Context mapping - ENABLED for analytics
                    "context": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "platform": {"type": "keyword"},
                            "language": {"type": "keyword"},
                            "extensions": {"type": "object", "enabled": True},
                        },
                    },
                }
            },
            "settings": {"number_of_shards": 1, "number_of_replicas": 0, "index": {"refresh_interval": "30s"}},
        }

        try:
            response = await client.indices.create(
                index=self.index_name, body=mapping, ignore=400  # Ignore if index already exists
            )

            logger.info(f"Created/verified Elasticsearch index: {self.index_name}")
            return {"success": True, "index": self.index_name, "response": response}

        except Exception as e:
            logger.error(f"Error creating Elasticsearch index: {str(e)}")
            raise

    # ========================================================================
    # SURVEY ANALYTICS (PORTED FROM RALPH LRS)
    # ========================================================================

    async def get_survey_analytics(
        self,
        survey_id: str,
        question_id: Optional[str] = None,
        group_by: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 10000,
    ) -> Dict[str, Any]:
        """
        Get comprehensive survey analytics with question-type-specific aggregations.
        Ported from Ralph LRS service with identical functionality.
        """
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")

        try:
            # Build base query for survey responses
            query = {
                "bool": {
                    "must": [
                        {"term": {"verb.id.keyword": "http://adlnet.gov/expapi/verbs/answered"}},
                        {
                            "bool": {
                                "should": [
                                    {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": survey_id}},
                                    {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": f"http://nlj.platform/content/{survey_id}"}}
                                ],
                                "minimum_should_match": 1
                            }
                        }
                    ]
                }
            }
            
            # Add time filter if specified
            if since:
                query["bool"]["must"].append({"range": {"timestamp": {"gte": since}}})
            
            # Add question filter if specified
            if question_id:
                query["bool"]["must"].append({
                    "term": {"object.id.keyword": f"http://nlj.platform/questions/{question_id}"}
                })
            
            # Build aggregations for response analysis
            aggs = {
                # Response value distribution
                "response_distribution": {
                    "terms": {
                        "field": "result.response.keyword",
                        "size": 50,
                        "missing": "no_response"
                    }
                },
                
                # Question breakdown
                "questions": {
                    "terms": {
                        "field": "object.id.keyword",
                        "size": 100
                    },
                    "aggs": {
                        "responses": {
                            "terms": {
                                "field": "result.response.keyword",
                                "size": 20
                            }
                        },
                        "avg_score": {
                            "avg": {
                                "field": "result.score.scaled",
                                "missing": 0
                            }
                        },
                        "question_type": {
                            "terms": {
                                "field": "context.extensions.http://nlj.platform/extensions/question_type.keyword",
                                "size": 20
                            }
                        }
                    }
                },
                
                # Respondent demographics
                "demographics": {
                    "terms": {
                        "field": "actor.mbox.keyword",
                        "size": 1000
                    }
                },
                
                # Time-based trends
                "timeline": {
                    "date_histogram": {
                        "field": "timestamp",
                        "calendar_interval": "1d",
                        "min_doc_count": 1
                    },
                    "aggs": {
                        "unique_respondents": {
                            "cardinality": {
                                "field": "actor.mbox.keyword"
                            }
                        }
                    }
                }
            }
            
            # Add demographic grouping if specified
            if group_by:
                demographic_field = f"context.extensions.http://nlj.platform/extensions/{group_by}.keyword"
                aggs["demographic_breakdown"] = {
                    "terms": {
                        "field": demographic_field,
                        "size": 50,
                        "missing": "not_specified"
                    },
                    "aggs": {
                        "responses": {
                            "terms": {
                                "field": "result.response.keyword",
                                "size": 20
                            }
                        },
                        "avg_score": {
                            "avg": {
                                "field": "result.score.scaled"
                            }
                        },
                        "unique_respondents": {
                            "cardinality": {
                                "field": "actor.mbox.keyword"
                            }
                        }
                    }
                }
            
            # Execute search
            response = await client.search(
                index=self.index_name,
                query=query,
                aggs=aggs,
                size=0  # Only need aggregations
            )
            
            # Transform aggregation results
            analytics_data = self._transform_survey_aggregations(
                response["aggregations"], survey_id, question_id, group_by
            )
            
            logger.info(f"Generated survey analytics for {survey_id}, found {response['hits']['total']['value']} responses")
            
            return {
                "success": True,
                "survey_id": survey_id,
                "question_id": question_id,
                "group_by": group_by,
                "data": analytics_data,
                "total_responses": response["hits"]["total"]["value"],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error generating survey analytics for {survey_id}: {str(e)}")
            return {"error": str(e), "success": False}

    def _transform_survey_aggregations(
        self, 
        aggregations: Dict[str, Any], 
        survey_id: str,
        question_id: Optional[str] = None,
        group_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transform Elasticsearch aggregation results into analytics format"""
        
        # Extract response distribution
        response_dist = aggregations.get("response_distribution", {})
        response_buckets = response_dist.get("buckets", [])
        
        overall_distribution = {}
        for bucket in response_buckets:
            response_value = bucket["key"]
            count = bucket["doc_count"]
            overall_distribution[response_value] = count
        
        # Extract question-level analytics
        questions_agg = aggregations.get("questions", {})
        question_buckets = questions_agg.get("buckets", [])
        
        question_analytics = {}
        for bucket in question_buckets:
            question_uri = bucket["key"]
            question_key = question_uri.split("/")[-1] if "/" in question_uri else question_uri
            
            # Extract response distribution for this question
            question_responses = {}
            for resp_bucket in bucket.get("responses", {}).get("buckets", []):
                question_responses[resp_bucket["key"]] = resp_bucket["doc_count"]
            
            # Get question type
            question_type = "unknown"
            type_buckets = bucket.get("question_type", {}).get("buckets", [])
            if type_buckets:
                question_type = type_buckets[0]["key"]
            
            question_analytics[question_key] = {
                "response_count": bucket["doc_count"],
                "response_distribution": question_responses,
                "average_score": bucket.get("avg_score", {}).get("value"),
                "question_type": question_type
            }
        
        # Extract demographic breakdown if requested
        demographic_data = {}
        if group_by and "demographic_breakdown" in aggregations:
            demo_buckets = aggregations["demographic_breakdown"].get("buckets", [])
            
            for bucket in demo_buckets:
                group_name = bucket["key"]
                group_responses = {}
                
                for resp_bucket in bucket.get("responses", {}).get("buckets", []):
                    group_responses[resp_bucket["key"]] = resp_bucket["doc_count"]
                
                demographic_data[group_name] = {
                    "total_responses": bucket["doc_count"],
                    "response_distribution": group_responses,
                    "average_score": bucket.get("avg_score", {}).get("value"),
                    "unique_respondents": bucket.get("unique_respondents", {}).get("value", 0)
                }
        
        # Extract timeline data
        timeline_buckets = aggregations.get("timeline", {}).get("buckets", [])
        timeline_data = []
        for bucket in timeline_buckets:
            timeline_data.append({
                "date": bucket["key_as_string"],
                "responses": bucket["doc_count"],
                "unique_respondents": bucket.get("unique_respondents", {}).get("value", 0)
            })
        
        # Calculate unique respondents
        unique_respondents = aggregations.get("demographics", {}).get("buckets", [])
        respondent_count = len(unique_respondents)
        
        return {
            "overview": {
                "unique_respondents": respondent_count,
                "response_distribution": overall_distribution,
                "response_rate": self._calculate_response_rate(overall_distribution, respondent_count)
            },
            "questions": question_analytics,
            "demographics": demographic_data if group_by else {},
            "timeline": timeline_data,
            "demographic_grouping": group_by
        }
    
    def _calculate_response_rate(self, distribution: Dict[str, int], respondent_count: int) -> float:
        """Calculate response rate as percentage"""
        total_responses = sum(distribution.values())
        if respondent_count == 0:
            return 0.0
        return round((total_responses / respondent_count) * 100, 2)

    # ========================================================================
    # LEARNER ANALYTICS (EXISTING - MAINTAINED)
    # ========================================================================

    async def get_learner_analytics(self, learner_email: str, since: Optional[str] = None) -> LearnerAnalytics:
        """Get comprehensive analytics for a specific learner (unchanged from existing service)"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")

        # Build query filters
        query_filter = [{"term": {"actor.mbox": f"mailto:{learner_email}"}}]

        if since:
            query_filter.append({"range": {"timestamp": {"gte": since}}})

        # Main analytics query
        query = {
            "size": 0,  # We only want aggregations
            "query": {"bool": {"filter": query_filter}},
            "aggs": {
                # Total activities count
                "total_activities": {"cardinality": {"field": "object.id.keyword"}},
                # Completed activities
                "completed_activities": {
                    "filter": {
                        "bool": {
                            "should": [
                                {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                {"term": {"result.completion": True}},
                            ]
                        }
                    },
                    "aggs": {"unique_completed": {"cardinality": {"field": "object.id.keyword"}}},
                },
                # Average score
                "average_score": {"avg": {"field": "result.score.scaled"}},
                # Activity timeline for streak calculation
                "daily_activity": {
                    "date_histogram": {"field": "timestamp", "calendar_interval": "day", "min_doc_count": 1}
                },
                # Recent activities
                "recent_activities": {
                    "top_hits": {
                        "sort": [{"timestamp": {"order": "desc"}}],
                        "size": 10,
                        "_source": {
                            "includes": ["object.id", "object.definition.name", "verb.id", "result", "timestamp"]
                        },
                    }
                },
                # Progress by program (using context extensions)
                "programs": {
                    "terms": {"field": "context.extensions.http://nlj\\.platform/extensions/program_id", "size": 20},
                    "aggs": {
                        "program_completion": {
                            "filter": {
                                "bool": {
                                    "should": [
                                        {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                        {"term": {"result.completion": True}},
                                    ]
                                }
                            }
                        }
                    },
                },
            },
        }

        try:
            response = await client.search(index=self.index_name, body=query)

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
                    "completion_rate": (
                        (completed_program_activities / total_program_activities * 100)
                        if total_program_activities > 0
                        else 0
                    ),
                }

            # Get learner name from recent activity
            learner_name = learner_email.split("@")[0].title()

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
                progress_by_program=progress_by_program,
            )

        except NotFoundError:
            # Index doesn't exist yet - return empty learner analytics
            logger.info(f"Index {self.index_name} not found - returning empty learner analytics")
            return LearnerAnalytics(
                learner_email=learner_email,
                learner_name=learner_email.split("@")[0].title(),
                total_activities=0,
                completed_activities=0,
                completion_rate=0.0,
                average_score=None,
                total_time_spent=0,
                learning_streak=0,
                recent_activities=[],
                progress_by_program={},
            )
        except Exception as e:
            logger.error(f"Error getting learner analytics for {learner_email}: {str(e)}")
            raise

    # ========================================================================
    # PLATFORM ANALYTICS (EXISTING - MAINTAINED)
    # ========================================================================

    async def get_platform_overview(self, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
        """Get platform-wide analytics overview (unchanged from existing service)"""
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
            "query": ({"bool": {"filter": query_filter}} if query_filter else {"match_all": {}}),
            "aggs": {
                "total_statements": {"value_count": {"field": "id.keyword"}},
                "unique_learners": {"cardinality": {"field": "actor.mbox.keyword"}},
                "unique_activities": {"cardinality": {"field": "object.id.keyword"}},
                "completion_rate": {
                    "filter": {
                        "bool": {
                            "should": [
                                {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                {"term": {"result.completion": True}},
                            ]
                        }
                    }
                },
                "average_score": {"avg": {"field": "result.score.scaled"}},
                "activity_timeline": {
                    "date_histogram": {"field": "timestamp", "calendar_interval": "day", "min_doc_count": 0}
                },
                "top_verbs": {"terms": {"field": "verb.id.keyword", "size": 10}},
                "activity_types": {"terms": {"field": "object.definition.type.keyword", "size": 10}},
            },
        }

        try:
            response = await client.search(index=self.index_name, body=query)

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
                    {"date": bucket["key_as_string"], "count": bucket["doc_count"]}
                    for bucket in aggs["activity_timeline"]["buckets"]
                ],
                "top_verbs": [
                    {"verb": bucket["key"], "count": bucket["doc_count"]} for bucket in aggs["top_verbs"]["buckets"]
                ],
                "activity_types": [
                    {"type": bucket["key"], "count": bucket["doc_count"]}
                    for bucket in aggs["activity_types"]["buckets"]
                ],
                "generated_at": datetime.now(timezone.utc).isoformat(),
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
                "generated_at": datetime.now(timezone.utc).isoformat(),
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
                "tested_at": datetime.now(timezone.utc).isoformat(),
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
                "tested_at": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            error_msg = f"Elasticsearch connection error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "status": "connection_failed",
                "error": error_msg,
                "endpoint": self.elasticsearch_url,
                "tested_at": datetime.now(timezone.utc).isoformat(),
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
            bucket_date = datetime.fromisoformat(bucket["key_as_string"].split("T")[0]).date()

            # Check if this date is consecutive
            expected_date = current_date - timedelta(days=streak)

            if bucket_date == expected_date:
                streak += 1
            else:
                break

        return streak

    # ========================================================================
    # NODE-SPECIFIC ANALYTICS METHODS
    # ========================================================================

    async def create_node_performance_index(self) -> Dict[str, Any]:
        """Create specialized index for node performance analytics"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")

        index_name = "node-performance-daily"
        
        # Node performance mapping optimized for time-series analytics
        mapping = {
            "mappings": {
                "properties": {
                    "node_id": {"type": "keyword"},
                    "date": {"type": "date"},
                    "node_type": {"type": "keyword"}, 
                    "content_hash": {"type": "keyword"},
                    "title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                    
                    # Learning concepts
                    "learning_objectives": {"type": "keyword"},
                    "keywords": {"type": "keyword"},
                    "domain": {"type": "keyword"},
                    
                    # Performance metrics
                    "total_interactions": {"type": "integer"},
                    "success_rate": {"type": "float"},
                    "avg_completion_time_ms": {"type": "integer"},
                    "difficulty_score": {"type": "float"},
                    "engagement_score": {"type": "float"},
                    "unique_users": {"type": "integer"},
                    
                    # Activity context
                    "activities_used_in": {"type": "keyword"},
                    "activity_contexts": {
                        "type": "nested",
                        "properties": {
                            "activity_id": {"type": "keyword"},
                            "activity_title": {"type": "keyword"},
                            "success_rate_in_activity": {"type": "float"},
                            "avg_time_in_activity": {"type": "integer"}
                        }
                    },
                    
                    # Aggregation metadata
                    "aggregated_at": {"type": "date"},
                    "data_points": {"type": "integer"}
                }
            },
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "index": {"refresh_interval": "60s"}
            }
        }

        try:
            response = await client.indices.create(
                index=index_name, body=mapping, ignore=400
            )
            logger.info(f"Created/verified node performance index: {index_name}")
            return {"success": True, "index": index_name, "response": response}

        except Exception as e:
            logger.error(f"Error creating node performance index: {str(e)}")
            raise

    async def _ensure_node_index(self, index_name: str) -> None:
        """Ensure node-specific index exists with proper mapping"""
        client = await self._get_client()
        if not client:
            return

        try:
            # Check if index exists
            exists = await client.indices.exists(index=index_name)
            if exists:
                return

            # Create index with node-enhanced mapping
            mapping = await self._get_node_enhanced_mapping()
            await client.indices.create(
                index=index_name, body=mapping, ignore=400
            )
            logger.info(f"Created node-specific index: {index_name}")

        except Exception as e:
            logger.warning(f"Failed to ensure node index {index_name}: {e}")

    async def _get_node_enhanced_mapping(self) -> Dict[str, Any]:
        """Get enhanced mapping for node-specific indexes"""
        return {
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "timestamp": {"type": "date"},
                    "stored": {"type": "date"},
                    "version": {"type": "keyword"},
                    
                    # Enhanced actor mapping
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
                            },
                        },
                    },
                    
                    # Enhanced verb mapping
                    "verb": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "id": {"type": "keyword"}, 
                            "display": {"type": "object", "enabled": False}
                        },
                    },
                    
                    # Enhanced object mapping with node metadata
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
                                    "interactionType": {"type": "keyword"},
                                    "extensions": {
                                        "type": "object",
                                        "properties": {
                                            # Node metadata
                                            "http://nlj.platform/extensions/node_metadata": {
                                                "type": "object",
                                                "properties": {
                                                    "node_id": {"type": "keyword"},
                                                    "node_type": {"type": "keyword"},
                                                    "content_hash": {"type": "keyword"},
                                                    "title": {"type": "text"},
                                                    "difficulty_level": {"type": "integer"},
                                                    "created_at": {"type": "date"},
                                                    "updated_at": {"type": "date"}
                                                }
                                            },
                                            # Performance context
                                            "http://nlj.platform/extensions/performance_context": {
                                                "type": "object", 
                                                "properties": {
                                                    "node_historical_success_rate": {"type": "float"},
                                                    "node_difficulty_score": {"type": "float"},
                                                    "node_engagement_score": {"type": "float"}
                                                }
                                            },
                                            # Learning concepts
                                            "http://nlj.platform/extensions/learning_concepts": {
                                                "type": "object",
                                                "properties": {
                                                    "learning_objectives": {
                                                        "type": "nested",
                                                        "properties": {
                                                            "id": {"type": "keyword"},
                                                            "text": {"type": "text"},
                                                            "domain": {"type": "keyword"},
                                                            "cognitive_level": {"type": "keyword"}
                                                        }
                                                    },
                                                    "keywords": {
                                                        "type": "nested", 
                                                        "properties": {
                                                            "id": {"type": "keyword"},
                                                            "text": {"type": "keyword"},
                                                            "domain": {"type": "keyword"},
                                                            "category": {"type": "keyword"}
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                            },
                        },
                    },
                    
                    # Enhanced result mapping
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
                                    "max": {"type": "float"},
                                },
                            },
                            "duration": {"type": "keyword"},
                            "response": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                        },
                    },
                    
                    # Enhanced context mapping
                    "context": {
                        "type": "object",
                        "enabled": True,
                        "properties": {
                            "platform": {"type": "keyword"},
                            "language": {"type": "keyword"},
                            "registration": {"type": "keyword"},
                            "extensions": {
                                "type": "object",
                                "properties": {
                                    "http://nlj.platform/extensions/session_id": {"type": "keyword"},
                                    "http://nlj.platform/extensions/activity_id": {"type": "keyword"},
                                    "http://nlj.platform/extensions/response_time_ms": {"type": "integer"},
                                    "http://nlj.platform/extensions/attempts": {"type": "integer"},
                                    "http://nlj.platform/extensions/sequence_context": {
                                        "type": "object",
                                        "properties": {
                                            "current_position": {"type": "integer"},
                                            "total_nodes": {"type": "integer"}, 
                                            "progress_percentage": {"type": "float"}
                                        }
                                    }
                                }
                            }
                        },
                    },
                }
            },
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "index": {"refresh_interval": "30s"}
            }
        }

    async def get_node_performance_analytics(
        self, 
        node_id: str,
        since: Optional[str] = None,
        include_activity_breakdown: bool = False
    ) -> Dict[str, Any]:
        """Get comprehensive performance analytics for a specific node"""
        client = await self._get_client()
        if not client:
            raise Exception("Elasticsearch client not available")

        # Build query for node-specific statements
        query = {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {"term": {"object.id.keyword": f"node://{node_id}"}},
                                {"term": {"object.definition.extensions.http://nlj.platform/extensions/node_metadata.node_id.keyword": node_id}}
                            ],
                            "minimum_should_match": 1
                        }
                    }
                ]
            }
        }

        # Add time filter if specified
        if since:
            query["bool"]["filter"] = [{"range": {"timestamp": {"gte": since}}}]

        # Build aggregations for analytics
        aggregations = {
            "total_interactions": {"value_count": {"field": "id.keyword"}},
            "unique_users": {"cardinality": {"field": "actor.account.name.keyword"}},
            "success_rate": {"avg": {"field": "result.success"}},
            "avg_response_time": {"avg": {"field": "context.extensions.http://nlj.platform/extensions/response_time_ms"}},
            "completion_rate": {"avg": {"field": "result.completion"}},
            "daily_activity": {
                "date_histogram": {
                    "field": "timestamp",
                    "calendar_interval": "day",
                    "format": "yyyy-MM-dd"
                },
                "aggs": {
                    "interactions": {"value_count": {"field": "id.keyword"}},
                    "success_rate": {"avg": {"field": "result.success"}}
                }
            }
        }

        # Add activity breakdown if requested
        if include_activity_breakdown:
            aggregations["by_activity"] = {
                "terms": {
                    "field": "context.extensions.http://nlj.platform/extensions/activity_id.keyword",
                    "size": 50
                },
                "aggs": {
                    "interactions": {"value_count": {"field": "id.keyword"}},
                    "success_rate": {"avg": {"field": "result.success"}},
                    "avg_response_time": {"avg": {"field": "context.extensions.http://nlj.platform/extensions/response_time_ms"}}
                }
            }

        search_body = {
            "query": query,
            "aggs": aggregations,
            "size": 0  # Only return aggregations
        }

        try:
            response = await client.search(index=self.index_name, body=search_body)
            aggs = response["aggregations"]
            
            result = {
                "node_id": node_id,
                "total_interactions": aggs["total_interactions"]["value"],
                "unique_users": aggs["unique_users"]["value"], 
                "success_rate": round(aggs["success_rate"]["value"] * 100, 1) if aggs["success_rate"]["value"] else 0,
                "avg_response_time_ms": round(aggs["avg_response_time"]["value"]) if aggs["avg_response_time"]["value"] else None,
                "completion_rate": round(aggs["completion_rate"]["value"] * 100, 1) if aggs["completion_rate"]["value"] else 0,
                "daily_activity": [
                    {
                        "date": bucket["key_as_string"],
                        "interactions": bucket["interactions"]["value"],
                        "success_rate": round(bucket["success_rate"]["value"] * 100, 1) if bucket["success_rate"]["value"] else 0
                    }
                    for bucket in aggs["daily_activity"]["buckets"]
                ],
                "generated_at": datetime.now(timezone.utc).isoformat()
            }

            if include_activity_breakdown:
                result["activity_breakdown"] = [
                    {
                        "activity_id": bucket["key"],
                        "interactions": bucket["interactions"]["value"],
                        "success_rate": round(bucket["success_rate"]["value"] * 100, 1) if bucket["success_rate"]["value"] else 0,
                        "avg_response_time_ms": round(bucket["avg_response_time"]["value"]) if bucket["avg_response_time"]["value"] else None
                    }
                    for bucket in aggs["by_activity"]["buckets"]
                ]

            return result

        except NotFoundError:
            logger.info(f"No data found for node {node_id}")
            return {
                "node_id": node_id,
                "total_interactions": 0,
                "unique_users": 0,
                "success_rate": 0,
                "avg_response_time_ms": None,
                "completion_rate": 0,
                "daily_activity": [],
                "generated_at": datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting node analytics for {node_id}: {str(e)}")
            raise


# Global Elasticsearch service instance
elasticsearch_service = ElasticsearchService()


# Dependency injection functions for FastAPI
async def get_elasticsearch_service() -> ElasticsearchService:
    """Get Elasticsearch service instance for dependency injection"""
    return elasticsearch_service