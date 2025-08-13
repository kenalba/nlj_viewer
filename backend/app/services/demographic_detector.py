"""
Demographic Detection Service
Auto-detects demographic groupings from xAPI context extensions and user data.
Provides intelligent extraction and categorization of demographic information.
"""

import logging
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta
import re

logger = logging.getLogger(__name__)


class DemographicDetector:
    """
    Detects and categorizes demographic information from xAPI statements and user data.
    Provides auto-detection of available demographic fields and intelligent grouping.
    """
    
    # Standard xAPI extension mappings
    STANDARD_EXTENSIONS = {
        # Organizational demographics
        "http://nlj.platform/extensions/department": "department",
        "http://nlj.platform/extensions/location": "location", 
        "http://nlj.platform/extensions/team": "team",
        "http://nlj.platform/extensions/business_unit": "business_unit",
        "http://nlj.platform/extensions/division": "division",
        
        # Role-based demographics
        "http://nlj.platform/extensions/role": "role",
        "http://nlj.platform/extensions/job_title": "role",
        "http://nlj.platform/extensions/manager": "manager",
        "http://nlj.platform/extensions/job_level": "job_level",
        "http://nlj.platform/extensions/employment_type": "employment_type",
        
        # Tenure demographics  
        "http://nlj.platform/extensions/tenure_months": "tenure",
        "http://nlj.platform/extensions/hire_date": "hire_date",
        "http://nlj.platform/extensions/service_years": "service_years",
        
        # Personal demographics (if collected)
        "http://nlj.platform/extensions/generation": "generation", 
        "http://nlj.platform/extensions/age_range": "age_range",
        "http://nlj.platform/extensions/gender": "gender",
        "http://nlj.platform/extensions/education_level": "education_level",
        
        # Survey-specific demographics
        "http://nlj.platform/extensions/audience": "audience",
        "http://nlj.platform/extensions/segment": "segment",
        "http://nlj.platform/extensions/cohort": "cohort",
    }
    
    # Tenure range definitions (in months)
    TENURE_RANGES = [
        (0, 6, "0-6 months"),
        (6, 12, "6-12 months"), 
        (12, 24, "1-2 years"),
        (24, 60, "2-5 years"),
        (60, 120, "5-10 years"),
        (120, float('inf'), "10+ years")
    ]
    
    def __init__(self):
        """Initialize demographic detector"""
        self.detected_fields = set()
        self.field_frequencies = Counter()
        self.field_samples = defaultdict(set)
    
    def analyze_xapi_statements(self, statements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze xAPI statements to detect available demographic fields.
        
        Args:
            statements: List of xAPI statements with context extensions
            
        Returns:
            Dictionary with detected demographic configuration
        """
        try:
            # Reset detection state
            self.detected_fields.clear()
            self.field_frequencies.clear()
            self.field_samples.clear()
            
            # Analyze each statement
            for statement in statements:
                self._analyze_statement_context(statement)
            
            # Generate demographic configuration
            return self._generate_demographic_config()
            
        except Exception as e:
            logger.error(f"Error analyzing xAPI statements for demographics: {e}")
            return self._get_default_config()
    
    def _analyze_statement_context(self, statement: Dict[str, Any]) -> None:
        """Analyze a single statement's context for demographic data"""
        try:
            context = statement.get("context", {})
            extensions = context.get("extensions", {})
            
            # Check for standard demographic extensions
            for extension_uri, field_name in self.STANDARD_EXTENSIONS.items():
                if extension_uri in extensions:
                    value = extensions[extension_uri]
                    if value and str(value).strip():  # Only count non-empty values
                        self.detected_fields.add(field_name)
                        self.field_frequencies[field_name] += 1
                        
                        # Store sample values (limit to prevent memory issues)
                        if len(self.field_samples[field_name]) < 50:
                            self.field_samples[field_name].add(str(value))
            
            # Check for custom extensions (additional demographic fields)
            for extension_uri, value in extensions.items():
                if self._is_potential_demographic_field(extension_uri, value):
                    field_name = self._extract_field_name_from_uri(extension_uri)
                    if field_name and field_name not in self.STANDARD_EXTENSIONS.values():
                        self.detected_fields.add(field_name)
                        self.field_frequencies[field_name] += 1
                        
                        if len(self.field_samples[field_name]) < 50:
                            self.field_samples[field_name].add(str(value))
            
        except Exception as e:
            logger.debug(f"Error analyzing statement context: {e}")
    
    def _is_potential_demographic_field(self, uri: str, value: Any) -> bool:
        """
        Determine if an extension URI/value pair represents demographic data.
        
        Heuristics:
        - Contains demographic keywords in URI
        - Value is categorical (string, not too long)
        - Not obviously non-demographic (timestamps, IDs, etc.)
        """
        try:
            # Check URI for demographic keywords
            uri_lower = uri.lower()
            demographic_keywords = [
                'department', 'location', 'team', 'role', 'title', 'manager',
                'level', 'type', 'group', 'category', 'segment', 'cohort',
                'region', 'office', 'site', 'division', 'unit', 'branch'
            ]
            
            has_demographic_keyword = any(keyword in uri_lower for keyword in demographic_keywords)
            if not has_demographic_keyword:
                return False
            
            # Check value characteristics
            value_str = str(value).strip()
            if not value_str:
                return False
            
            # Exclude obvious non-demographic values
            if self._is_non_demographic_value(value_str):
                return False
            
            # Must be reasonable length for categorical data
            if len(value_str) > 100:
                return False
            
            return True
            
        except Exception:
            return False
    
    def _is_non_demographic_value(self, value: str) -> bool:
        """Check if a value is obviously non-demographic"""
        # Check for UUIDs, timestamps, URLs, email addresses, etc.
        patterns = [
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',  # UUID
            r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',  # ISO timestamp
            r'^https?://',  # URL
            r'^[^@]+@[^@]+\.[^@]+$',  # Email
            r'^\d+$',  # Pure numbers (could be IDs)
        ]
        
        return any(re.match(pattern, value, re.IGNORECASE) for pattern in patterns)
    
    def _extract_field_name_from_uri(self, uri: str) -> Optional[str]:
        """Extract a clean field name from an extension URI"""
        try:
            # Extract the last part after the final slash
            field_name = uri.split('/')[-1]
            
            # Clean up the field name
            field_name = re.sub(r'[^a-zA-Z0-9_]', '_', field_name).lower()
            field_name = re.sub(r'_+', '_', field_name).strip('_')
            
            # Must be reasonable length and format
            if 2 <= len(field_name) <= 50 and field_name.replace('_', '').isalnum():
                return field_name
            
            return None
            
        except Exception:
            return None
    
    def _generate_demographic_config(self) -> Dict[str, Any]:
        """Generate demographic configuration from detected fields"""
        try:
            # Prioritize fields by frequency and importance
            primary_fields = self._get_primary_demographic_fields()
            secondary_fields = self._get_secondary_demographic_fields()
            
            # Calculate coverage statistics
            total_statements = sum(self.field_frequencies.values()) if self.field_frequencies else 1
            field_coverage = {
                field: {
                    "frequency": count,
                    "coverage_percentage": round((count / total_statements) * 100, 1),
                    "sample_values": list(self.field_samples.get(field, []))[:10],  # First 10 samples
                    "unique_values": len(self.field_samples.get(field, [])),
                }
                for field, count in self.field_frequencies.items()
            }
            
            return {
                "success": True,
                "detected_fields": list(self.detected_fields),
                "primary_demographics": primary_fields,
                "secondary_demographics": secondary_fields, 
                "field_coverage": field_coverage,
                "total_fields_detected": len(self.detected_fields),
                "recommended_groupings": self._get_recommended_groupings(primary_fields),
                "configuration": {
                    "primary": primary_fields,
                    "secondary": secondary_fields,
                    "hierarchical": len(primary_fields) > 0,
                    "anonymization_threshold": 4,
                    "available_groupings": list(self.detected_fields),
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating demographic config: {e}")
            return self._get_default_config()
    
    def _get_primary_demographic_fields(self) -> List[str]:
        """Get primary demographic fields based on importance and frequency"""
        # Priority order for primary demographics
        priority_order = [
            "department", "location", "team", "business_unit", "division",
            "role", "job_level", "manager", "audience", "segment"
        ]
        
        primary = []
        for field in priority_order:
            if field in self.detected_fields and self.field_frequencies.get(field, 0) > 0:
                # Only include if it has good coverage and reasonable cardinality
                unique_count = len(self.field_samples.get(field, []))
                if 2 <= unique_count <= 20:  # Good demographic range
                    primary.append(field)
                    if len(primary) >= 3:  # Limit primary demographics
                        break
        
        return primary
    
    def _get_secondary_demographic_fields(self) -> List[str]:
        """Get secondary demographic fields"""
        secondary_candidates = [
            "tenure", "hire_date", "service_years", "employment_type", 
            "generation", "age_range", "gender", "education_level",
            "cohort", "custom_1", "custom_2"
        ]
        
        secondary = []
        for field in secondary_candidates:
            if field in self.detected_fields and field not in self._get_primary_demographic_fields():
                unique_count = len(self.field_samples.get(field, []))
                if 2 <= unique_count <= 50:  # Broader range for secondary
                    secondary.append(field)
        
        return secondary
    
    def _get_recommended_groupings(self, primary_fields: List[str]) -> List[Dict[str, Any]]:
        """Get recommended demographic groupings for analytics"""
        recommendations = []
        
        for field in primary_fields[:2]:  # Top 2 primary fields
            samples = list(self.field_samples.get(field, []))[:5]
            recommendations.append({
                "field": field,
                "display_name": field.replace("_", " ").title(),
                "reason": f"High coverage ({self.field_frequencies.get(field, 0)} responses)",
                "sample_values": samples,
                "estimated_groups": len(self.field_samples.get(field, [])),
            })
        
        return recommendations
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default demographic configuration when detection fails"""
        return {
            "success": False,
            "detected_fields": [],
            "primary_demographics": ["department", "location"],  # Sensible defaults
            "secondary_demographics": ["tenure", "role"],
            "field_coverage": {},
            "total_fields_detected": 0,
            "recommended_groupings": [],
            "configuration": {
                "primary": ["department", "location"],
                "secondary": ["tenure", "role"],
                "hierarchical": True,
                "anonymization_threshold": 4,
                "available_groupings": ["department", "location", "tenure", "role"],
            },
            "error": "No demographic data detected in xAPI statements"
        }
    
    def categorize_tenure(self, tenure_months: int) -> str:
        """Categorize tenure in months into ranges"""
        for min_months, max_months, label in self.TENURE_RANGES:
            if min_months <= tenure_months < max_months:
                return label
        return "Unknown"
    
    def detect_generation(self, age: Optional[int] = None, birth_year: Optional[int] = None) -> str:
        """Detect generation based on age or birth year"""
        if birth_year:
            if birth_year >= 1997:
                return "Gen Z"
            elif birth_year >= 1981:
                return "Millennial"
            elif birth_year >= 1965:
                return "Gen X"
            elif birth_year >= 1946:
                return "Baby Boomer"
            else:
                return "Silent Generation"
        
        if age:
            current_year = datetime.now().year
            return self.detect_generation(birth_year=current_year - age)
        
        return "Unknown"


# Export singleton instance
demographic_detector = DemographicDetector()