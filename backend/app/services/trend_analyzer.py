"""
Survey Trend Analyzer
Provides time-series analysis for survey responses with trend detection and classification.
Analyzes response patterns over time to identify trends and changes.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import statistics

logger = logging.getLogger(__name__)


class TrendAnalyzer:
    """
    Analyzes survey response trends over time with intelligent pattern recognition.
    Provides trend classification, change detection, and statistical analysis.
    """
    
    # Trend classification thresholds (percentage change)
    TREND_THRESHOLDS = {
        "skyrocketing": 25.0,      # >25% improvement
        "trending_up": 6.0,        # 6-25% improvement
        "steady": 5.0,             # -5% to +5% (steady)
        "trending_down": -6.0,     # -6% to -24% decline
        "plummeting": -25.0,       # <-25% decline
    }
    
    # Time period definitions
    TIME_PERIODS = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
        "180d": timedelta(days=180),
        "365d": timedelta(days=365),
    }
    
    def __init__(self):
        """Initialize trend analyzer"""
        pass
    
    def analyze_survey_trends(
        self, 
        analytics_data: Dict[str, Any], 
        timeframe: str = "30d"
    ) -> List[Dict[str, Any]]:
        """
        Analyze trends for all questions in a survey.
        
        Args:
            analytics_data: Raw analytics data from Ralph LRS/ElasticSearch
            timeframe: Time period to analyze ("7d", "30d", "90d", "180d", "365d")
            
        Returns:
            List of trend analysis results for each question
        """
        try:
            trends = []
            questions_data = analytics_data.get("data", {}).get("questions", {})
            
            for question_id, question_data in questions_data.items():
                trend_analysis = self._analyze_question_trend(
                    question_id, 
                    question_data, 
                    timeframe
                )
                if trend_analysis:
                    trends.append(trend_analysis)
            
            # Sort by significance (largest changes first)
            trends.sort(key=lambda x: abs(x.get("change_percentage", 0)), reverse=True)
            
            return trends
            
        except Exception as e:
            logger.error(f"Error analyzing survey trends: {e}")
            return []
    
    def _analyze_question_trend(
        self, 
        question_id: str, 
        question_data: Dict[str, Any], 
        timeframe: str
    ) -> Optional[Dict[str, Any]]:
        """Analyze trend for a single question"""
        try:
            # Extract time-series data if available
            time_series = question_data.get("time_series", [])
            if not time_series or len(time_series) < 2:
                # No time series data, try to create from basic stats
                return self._create_basic_trend(question_id, question_data, timeframe)
            
            # Analyze time series data points
            return self._analyze_time_series(question_id, time_series, timeframe)
            
        except Exception as e:
            logger.debug(f"Error analyzing trend for question {question_id}: {e}")
            return None
    
    def _create_basic_trend(
        self, 
        question_id: str, 
        question_data: Dict[str, Any], 
        timeframe: str
    ) -> Dict[str, Any]:
        """Create basic trend analysis from current data only"""
        current_score = question_data.get("average", 0)
        response_count = question_data.get("response_count", 0)
        
        # Without historical data, we can only provide current state
        return {
            "question_id": question_id,
            "timeframe": timeframe,
            "current_score": current_score,
            "previous_score": None,
            "change_amount": 0,
            "change_percentage": 0,
            "trend_classification": "steady",
            "confidence": "low",  # Low confidence without historical data
            "response_count": response_count,
            "data_points": [],
            "analysis_type": "basic",
            "trend_description": f"Current average: {current_score:.2f} (no historical data available)",
            "statistical_significance": False,
        }
    
    def _analyze_time_series(
        self, 
        question_id: str, 
        time_series: List[Dict[str, Any]], 
        timeframe: str
    ) -> Dict[str, Any]:
        """Analyze time series data for trends"""
        try:
            # Sort data points by time
            sorted_points = sorted(time_series, key=lambda x: x.get("timestamp", ""))
            
            if len(sorted_points) < 2:
                return self._create_basic_trend(question_id, {"average": 0}, timeframe)
            
            # Get time period for comparison
            period_delta = self.TIME_PERIODS.get(timeframe, timedelta(days=30))
            cutoff_time = datetime.utcnow() - period_delta
            
            # Split data into recent and previous periods
            recent_points = []
            previous_points = []
            
            for point in sorted_points:
                point_time = self._parse_timestamp(point.get("timestamp"))
                if point_time and point_time >= cutoff_time:
                    recent_points.append(point)
                else:
                    previous_points.append(point)
            
            # Calculate average scores for each period
            current_score = self._calculate_period_average(recent_points)
            previous_score = self._calculate_period_average(previous_points)
            
            # Calculate change metrics
            change_amount = current_score - previous_score if previous_score else 0
            change_percentage = (
                (change_amount / previous_score * 100) 
                if previous_score and previous_score != 0 
                else 0
            )
            
            # Classify trend
            trend_classification = self._classify_trend(change_percentage)
            
            # Calculate confidence based on data quality
            confidence = self._calculate_confidence(recent_points, previous_points)
            
            # Generate trend description
            trend_description = self._generate_trend_description(
                current_score, previous_score, change_percentage, trend_classification
            )
            
            return {
                "question_id": question_id,
                "timeframe": timeframe,
                "current_score": round(current_score, 2),
                "previous_score": round(previous_score, 2) if previous_score else None,
                "change_amount": round(change_amount, 2),
                "change_percentage": round(change_percentage, 1),
                "trend_classification": trend_classification,
                "confidence": confidence,
                "response_count": len(recent_points),
                "data_points": self._format_data_points(sorted_points[-10:]),  # Last 10 points
                "analysis_type": "time_series",
                "trend_description": trend_description,
                "statistical_significance": self._test_significance(recent_points, previous_points),
                "period_comparison": {
                    "current_period_responses": len(recent_points),
                    "previous_period_responses": len(previous_points),
                    "total_data_points": len(sorted_points),
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing time series for {question_id}: {e}")
            return self._create_basic_trend(question_id, {"average": 0}, timeframe)
    
    def _parse_timestamp(self, timestamp_str: str) -> Optional[datetime]:
        """Parse timestamp string to datetime object"""
        try:
            # Handle various timestamp formats
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            return None
    
    def _calculate_period_average(self, data_points: List[Dict[str, Any]]) -> float:
        """Calculate average score for a period"""
        if not data_points:
            return 0.0
        
        scores = []
        for point in data_points:
            score = point.get("score") or point.get("average") or point.get("value")
            if score is not None:
                scores.append(float(score))
        
        return statistics.mean(scores) if scores else 0.0
    
    def _classify_trend(self, change_percentage: float) -> str:
        """Classify trend based on percentage change"""
        if change_percentage > self.TREND_THRESHOLDS["skyrocketing"]:
            return "skyrocketing"
        elif change_percentage > self.TREND_THRESHOLDS["trending_up"]:
            return "trending_up"
        elif change_percentage >= -self.TREND_THRESHOLDS["steady"]:
            return "steady"
        elif change_percentage >= self.TREND_THRESHOLDS["trending_down"]:
            return "trending_down"
        else:
            return "plummeting"
    
    def _calculate_confidence(
        self, 
        recent_points: List[Dict[str, Any]], 
        previous_points: List[Dict[str, Any]]
    ) -> str:
        """Calculate confidence level based on data quality"""
        total_points = len(recent_points) + len(previous_points)
        recent_count = len(recent_points)
        previous_count = len(previous_points)
        
        # High confidence: lots of data in both periods
        if total_points >= 50 and recent_count >= 10 and previous_count >= 10:
            return "high"
        # Medium confidence: decent amount of data
        elif total_points >= 20 and recent_count >= 5 and previous_count >= 5:
            return "medium"
        # Low confidence: limited data
        else:
            return "low"
    
    def _generate_trend_description(
        self, 
        current: float, 
        previous: float, 
        change_pct: float, 
        classification: str
    ) -> str:
        """Generate human-readable trend description"""
        if previous is None or previous == 0:
            return f"Current average: {current:.2f} (insufficient historical data)"
        
        direction = "increased" if change_pct > 0 else "decreased" if change_pct < 0 else "remained steady"
        magnitude = abs(change_pct)
        
        descriptions = {
            "skyrocketing": f"dramatically {direction}",
            "trending_up": "improved",
            "steady": "remained stable", 
            "trending_down": "declined",
            "plummeting": f"sharply {direction}"
        }
        
        description = descriptions.get(classification, direction)
        
        return (
            f"Score {description} from {previous:.2f} to {current:.2f} "
            f"({'+' if change_pct > 0 else ''}{change_pct:.1f}%)"
        )
    
    def _test_significance(
        self, 
        recent_points: List[Dict[str, Any]], 
        previous_points: List[Dict[str, Any]]
    ) -> bool:
        """Simple statistical significance test"""
        # Simplified significance test - in production, would use proper statistical tests
        recent_count = len(recent_points)
        previous_count = len(previous_points)
        
        # Need minimum sample sizes for significance
        if recent_count < 5 or previous_count < 5:
            return False
        
        # Calculate variance to determine if change is meaningful
        recent_scores = [
            point.get("score", point.get("average", 0)) 
            for point in recent_points
        ]
        previous_scores = [
            point.get("score", point.get("average", 0)) 
            for point in previous_points
        ]
        
        if len(recent_scores) < 2 or len(previous_scores) < 2:
            return False
        
        try:
            recent_var = statistics.variance(recent_scores)
            previous_var = statistics.variance(previous_scores)
            pooled_var = (recent_var + previous_var) / 2
            
            recent_mean = statistics.mean(recent_scores)
            previous_mean = statistics.mean(previous_scores)
            
            # Simple t-test approximation
            if pooled_var == 0:
                return recent_mean != previous_mean
            
            t_stat = abs(recent_mean - previous_mean) / (pooled_var ** 0.5)
            
            # Rough significance threshold
            return t_stat > 1.96  # Approximately 95% confidence
            
        except (statistics.StatisticsError, ZeroDivisionError):
            return False
    
    def _format_data_points(
        self, 
        data_points: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Format data points for frontend consumption"""
        formatted = []
        for point in data_points:
            formatted_point = {
                "timestamp": point.get("timestamp"),
                "score": point.get("score", point.get("average", point.get("value", 0))),
                "response_count": point.get("response_count", point.get("count", 1)),
            }
            formatted.append(formatted_point)
        
        return formatted
    
    def get_trend_insights(self, trends: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate high-level insights from trend analysis"""
        try:
            if not trends:
                return {"insights": [], "summary": "No trend data available"}
            
            insights = []
            
            # Find most significant trends
            improving_trends = [t for t in trends if t["change_percentage"] > 5]
            declining_trends = [t for t in trends if t["change_percentage"] < -5]
            stable_trends = [t for t in trends if -5 <= t["change_percentage"] <= 5]
            
            # Generate insights
            if improving_trends:
                top_improvement = max(improving_trends, key=lambda x: x["change_percentage"])
                insights.append({
                    "type": "improvement",
                    "question_id": top_improvement["question_id"],
                    "change": top_improvement["change_percentage"],
                    "description": f"Biggest improvement: {top_improvement['trend_description']}"
                })
            
            if declining_trends:
                top_decline = min(declining_trends, key=lambda x: x["change_percentage"])
                insights.append({
                    "type": "decline",
                    "question_id": top_decline["question_id"],
                    "change": top_decline["change_percentage"],
                    "description": f"Biggest concern: {top_decline['trend_description']}"
                })
            
            # Overall summary
            total_questions = len(trends)
            improving_count = len(improving_trends)
            declining_count = len(declining_trends)
            stable_count = len(stable_trends)
            
            summary = (
                f"{improving_count} improving, {declining_count} declining, "
                f"{stable_count} stable out of {total_questions} questions"
            )
            
            return {
                "insights": insights,
                "summary": summary,
                "distribution": {
                    "improving": improving_count,
                    "declining": declining_count,
                    "stable": stable_count,
                    "total": total_questions,
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating trend insights: {e}")
            return {"insights": [], "summary": "Error generating insights"}


# Export singleton instance
trend_analyzer = TrendAnalyzer()