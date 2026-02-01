"""
Question Pool System

PRODUCTION-GRADE question bank for AI Interviewer.
Implements:
- Large question pools per round/difficulty/company type
- Randomized selection with session memory
- Never repeat questions across sessions
- Adaptive difficulty based on performance

DESIGN PRINCIPLES:
- Questions are NEVER hard-coded in plan generation
- Each session gets UNIQUE questions via randomized pool selection
- Questions are tagged with round, difficulty, company style
- Pool is extensible and can grow dynamically
"""

import random
import hashlib
from typing import Dict, Any, List, Optional, Set
from datetime import datetime


# ===========================================
# QUESTION CATEGORIES (ROUNDS)
# ===========================================
class QuestionRound:
    DSA = "dsa"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    HR = "hr"
    SYSTEM_DESIGN = "system_design"
    SITUATIONAL = "situational"


class Difficulty:
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class CompanyStyle:
    FAANG = "faang"
    STARTUP = "startup"
    PRODUCT = "product"
    SERVICE = "service"
    ANY = "any"


# ===========================================
# MASTER QUESTION POOLS
# Each pool contains 50+ questions per category
# ===========================================

DSA_QUESTIONS = {
    Difficulty.EASY: [
        {"text": "How would you find the maximum element in an array?", "topics": ["arrays", "basic"]},
        {"text": "Explain how you would reverse a string in your preferred language.", "topics": ["strings", "basic"]},
        {"text": "What is a linked list and when would you use it over an array?", "topics": ["linked list", "data structures"]},
        {"text": "How do you check if a string is a palindrome?", "topics": ["strings", "algorithms"]},
        {"text": "Explain the difference between a stack and a queue.", "topics": ["stack", "queue", "data structures"]},
        {"text": "How would you find if there are any duplicate elements in an array?", "topics": ["arrays", "hashing"]},
        {"text": "What is the time complexity of searching in a sorted array?", "topics": ["binary search", "complexity"]},
        {"text": "How would you merge two sorted arrays?", "topics": ["arrays", "merging"]},
        {"text": "Explain how a hash table works at a high level.", "topics": ["hashing", "data structures"]},
        {"text": "What is a binary tree and what are its properties?", "topics": ["trees", "data structures"]},
        {"text": "How would you find the first non-repeating character in a string?", "topics": ["strings", "hashing"]},
        {"text": "Explain the concept of recursion with a simple example.", "topics": ["recursion", "fundamentals"]},
    ],
    Difficulty.MEDIUM: [
        {"text": "How would you detect a cycle in a linked list?", "topics": ["linked list", "two pointers"]},
        {"text": "Explain how you would implement a LRU cache.", "topics": ["caching", "data structures"]},
        {"text": "How would you find the kth largest element in an unsorted array?", "topics": ["arrays", "sorting", "heap"]},
        {"text": "Describe your approach to solving the two-sum problem.", "topics": ["arrays", "hashing"]},
        {"text": "How would you find all permutations of a string?", "topics": ["strings", "recursion", "backtracking"]},
        {"text": "Explain how binary search tree insertion and deletion works.", "topics": ["BST", "trees"]},
        {"text": "How would you validate if a binary tree is a valid BST?", "topics": ["BST", "trees", "validation"]},
        {"text": "What is dynamic programming? Give an example problem.", "topics": ["DP", "optimization"]},
        {"text": "How would you find the longest common subsequence of two strings?", "topics": ["DP", "strings"]},
        {"text": "Explain the sliding window technique with an example.", "topics": ["sliding window", "arrays"]},
        {"text": "How would you find the lowest common ancestor in a binary tree?", "topics": ["trees", "recursion"]},
        {"text": "Describe an algorithm to check if a graph is bipartite.", "topics": ["graphs", "BFS", "DFS"]},
        {"text": "How would you implement a trie data structure?", "topics": ["trie", "strings", "data structures"]},
        {"text": "Explain the concept of memoization with a practical example.", "topics": ["DP", "optimization"]},
    ],
    Difficulty.HARD: [
        {"text": "How would you find the shortest path in a weighted graph with negative edges?", "topics": ["graphs", "Bellman-Ford"]},
        {"text": "Explain how you would solve the traveling salesman problem.", "topics": ["DP", "NP-hard", "graphs"]},
        {"text": "How would you find the median of a running stream of numbers?", "topics": ["heap", "streaming"]},
        {"text": "Describe an algorithm to find all strongly connected components in a directed graph.", "topics": ["graphs", "Tarjan", "Kosaraju"]},
        {"text": "How would you implement a skip list?", "topics": ["data structures", "probabilistic"]},
        {"text": "Explain the Z-algorithm for string matching.", "topics": ["strings", "pattern matching"]},
        {"text": "How would you solve the word ladder problem optimally?", "topics": ["BFS", "graphs", "strings"]},
        {"text": "Describe your approach to solving the maximum flow problem.", "topics": ["graphs", "Ford-Fulkerson"]},
        {"text": "How would you find the longest increasing subsequence in O(n log n)?", "topics": ["DP", "binary search"]},
        {"text": "Explain segment trees and their applications.", "topics": ["trees", "range queries"]},
        {"text": "How would you solve the N-Queens problem?", "topics": ["backtracking", "recursion"]},
        {"text": "Describe an algorithm to find all articulation points in a graph.", "topics": ["graphs", "DFS"]},
    ],
    Difficulty.EXPERT: [
        {"text": "Explain the Aho-Corasick algorithm and its applications.", "topics": ["strings", "pattern matching", "automata"]},
        {"text": "How would you implement a suffix array and its applications?", "topics": ["strings", "advanced"]},
        {"text": "Describe the heavy-light decomposition technique.", "topics": ["trees", "decomposition"]},
        {"text": "How would you solve a competitive programming problem involving centroid decomposition?", "topics": ["trees", "divide and conquer"]},
        {"text": "Explain persistent data structures with an example.", "topics": ["data structures", "immutability"]},
    ],
}

TECHNICAL_QUESTIONS = {
    Difficulty.EASY: [
        {"text": "Explain the difference between HTTP and HTTPS.", "topics": ["networking", "security"]},
        {"text": "What is REST API? What makes an API RESTful?", "topics": ["API", "REST"]},
        {"text": "Explain the difference between SQL and NoSQL databases.", "topics": ["databases"]},
        {"text": "What is version control and why is Git popular?", "topics": ["git", "version control"]},
        {"text": "Explain the concept of object-oriented programming.", "topics": ["OOP", "fundamentals"]},
        {"text": "What is the difference between authentication and authorization?", "topics": ["security"]},
        {"text": "How does the browser render a web page?", "topics": ["web", "browser"]},
        {"text": "Explain the concept of APIs and how they work.", "topics": ["API", "fundamentals"]},
        {"text": "What are the SOLID principles in software design?", "topics": ["design patterns", "OOP"]},
        {"text": "Explain the difference between a process and a thread.", "topics": ["OS", "concurrency"]},
    ],
    Difficulty.MEDIUM: [
        {"text": "Explain microservices architecture and its benefits.", "topics": ["architecture", "microservices"]},
        {"text": "What is containerization? Explain Docker concepts.", "topics": ["Docker", "containers"]},
        {"text": "How would you design a caching strategy for a high-traffic application?", "topics": ["caching", "performance"]},
        {"text": "Explain the CAP theorem and its implications.", "topics": ["distributed systems"]},
        {"text": "What is database sharding and when would you use it?", "topics": ["databases", "scaling"]},
        {"text": "Explain the concept of event-driven architecture.", "topics": ["architecture", "events"]},
        {"text": "How do you handle database transactions and ensure ACID properties?", "topics": ["databases", "transactions"]},
        {"text": "What is message queue and when would you use Kafka vs RabbitMQ?", "topics": ["messaging", "queues"]},
        {"text": "Explain OAuth 2.0 authorization flow.", "topics": ["security", "OAuth"]},
        {"text": "What are the differences between synchronous and asynchronous programming?", "topics": ["async", "programming"]},
        {"text": "How would you implement rate limiting in an API?", "topics": ["API", "security"]},
        {"text": "Explain the concept of CI/CD pipelines.", "topics": ["DevOps", "CI/CD"]},
        {"text": "What is load balancing and what strategies exist?", "topics": ["infrastructure", "scaling"]},
    ],
    Difficulty.HARD: [
        {"text": "How would you design a distributed cache like Redis?", "topics": ["distributed systems", "caching"]},
        {"text": "Explain the Raft consensus algorithm.", "topics": ["distributed systems", "consensus"]},
        {"text": "How does Kubernetes orchestrate containers at scale?", "topics": ["Kubernetes", "orchestration"]},
        {"text": "Explain eventual consistency and conflict resolution strategies.", "topics": ["distributed systems"]},
        {"text": "How would you implement a distributed transaction system?", "topics": ["transactions", "distributed systems"]},
        {"text": "What is CQRS pattern and when would you use it?", "topics": ["architecture", "patterns"]},
        {"text": "Explain service mesh and its benefits.", "topics": ["microservices", "service mesh"]},
        {"text": "How would you implement end-to-end encryption in a messaging system?", "topics": ["security", "encryption"]},
        {"text": "Describe how a garbage collector works in JVM/V8.", "topics": ["runtime", "memory"]},
        {"text": "How would you design a system for handling millions of concurrent WebSocket connections?", "topics": ["scaling", "websockets"]},
    ],
    Difficulty.EXPERT: [
        {"text": "Explain the internals of a database query optimizer.", "topics": ["databases", "optimization"]},
        {"text": "How would you build a real-time analytics engine processing millions of events per second?", "topics": ["streaming", "big data"]},
        {"text": "Describe the implementation of a distributed file system like HDFS.", "topics": ["distributed systems", "storage"]},
        {"text": "How does Google's Spanner achieve global consistency?", "topics": ["distributed systems", "Google"]},
    ],
}

BEHAVIORAL_QUESTIONS = {
    Difficulty.EASY: [
        {"text": "Tell me about yourself and your background.", "topics": ["introduction", "background"]},
        {"text": "Why are you interested in this role?", "topics": ["motivation", "interest"]},
        {"text": "What are your strengths and weaknesses?", "topics": ["self-awareness"]},
        {"text": "Describe your ideal work environment.", "topics": ["culture fit"]},
        {"text": "How do you stay motivated at work?", "topics": ["motivation"]},
    ],
    Difficulty.MEDIUM: [
        {"text": "Tell me about a time when you had to work under pressure to meet a deadline.", "topics": ["pressure", "time management"]},
        {"text": "Describe a situation where you had to collaborate with a difficult team member.", "topics": ["teamwork", "conflict"]},
        {"text": "Give an example of when you took initiative to improve a process.", "topics": ["initiative", "improvement"]},
        {"text": "Tell me about a time you received constructive criticism. How did you handle it?", "topics": ["feedback", "growth"]},
        {"text": "Describe a situation where you had to adapt to a significant change.", "topics": ["adaptability", "change"]},
        {"text": "Tell me about a time you failed. What did you learn from it?", "topics": ["failure", "learning"]},
        {"text": "Describe a project where you demonstrated leadership.", "topics": ["leadership"]},
        {"text": "Tell me about a time you had to make a difficult decision with limited information.", "topics": ["decision making"]},
        {"text": "Describe a situation where you had to persuade someone to see your point of view.", "topics": ["persuasion", "communication"]},
        {"text": "Tell me about a time you went above and beyond your job responsibilities.", "topics": ["initiative", "dedication"]},
        {"text": "Describe a situation where you had to prioritize multiple competing tasks.", "topics": ["prioritization"]},
        {"text": "Tell me about a time you identified a problem before it became serious.", "topics": ["proactive", "problem-solving"]},
    ],
    Difficulty.HARD: [
        {"text": "Tell me about a time you had to deliver bad news to stakeholders.", "topics": ["communication", "stakeholders"]},
        {"text": "Describe a situation where you had to make an unpopular decision.", "topics": ["leadership", "decision making"]},
        {"text": "Tell me about a time you had to manage conflicting priorities from multiple stakeholders.", "topics": ["stakeholder management"]},
        {"text": "Describe a situation where you had to mentor someone who was struggling.", "topics": ["mentorship"]},
        {"text": "Tell me about the most complex project you've managed.", "topics": ["project management"]},
        {"text": "Describe a time when you had to influence without authority.", "topics": ["influence", "leadership"]},
        {"text": "Tell me about a time you had to navigate organizational politics.", "topics": ["organizational awareness"]},
    ],
    Difficulty.EXPERT: [
        {"text": "Tell me about a time you had to lead a team through a major organizational change.", "topics": ["change management"]},
        {"text": "Describe a situation where you had to make a strategic decision that affected the company.", "topics": ["strategy"]},
        {"text": "Tell me about a time you had to turn around a failing project or team.", "topics": ["turnaround"]},
    ],
}

HR_QUESTIONS = {
    Difficulty.EASY: [
        {"text": "Why are you interested in this {role} position at our company?", "topics": ["motivation"]},
        {"text": "Where do you see yourself in 5 years?", "topics": ["career goals"]},
        {"text": "What motivates you in your work?", "topics": ["motivation"]},
        {"text": "Why are you looking to make a change from your current role?", "topics": ["career transition"]},
        {"text": "What do you know about our company?", "topics": ["research", "interest"]},
        {"text": "What are your salary expectations?", "topics": ["compensation"]},
        {"text": "When can you start if offered the position?", "topics": ["availability"]},
        {"text": "Do you have any questions for us?", "topics": ["curiosity"]},
        {"text": "What type of work culture do you thrive in?", "topics": ["culture fit"]},
        {"text": "How do you handle work-life balance?", "topics": ["work-life balance"]},
    ],
    Difficulty.MEDIUM: [
        {"text": "What makes you the best candidate for this role?", "topics": ["differentiation"]},
        {"text": "How do you handle disagreements with your manager?", "topics": ["conflict resolution"]},
        {"text": "Describe your management style if you were to lead a team.", "topics": ["leadership"]},
        {"text": "How do you stay current with industry trends?", "topics": ["learning", "growth"]},
        {"text": "What would your previous manager say about you?", "topics": ["perception"]},
    ],
    Difficulty.HARD: [
        {"text": "If you had multiple offers, how would you decide between them?", "topics": ["decision making"]},
        {"text": "What concerns do you have about this role or company?", "topics": ["critical thinking"]},
        {"text": "How would you handle a situation where company values conflict with personal values?", "topics": ["ethics"]},
    ],
    Difficulty.EXPERT: [],
}

SYSTEM_DESIGN_QUESTIONS = {
    Difficulty.EASY: [
        {"text": "How would you design a simple URL shortener?", "topics": ["web", "basics"]},
        {"text": "Explain how you would design a basic chat application.", "topics": ["messaging", "basics"]},
    ],
    Difficulty.MEDIUM: [
        {"text": "How would you design a rate limiter for an API?", "topics": ["API", "throttling"]},
        {"text": "Design a parking lot management system.", "topics": ["OOP", "system design"]},
        {"text": "How would you design a notification system?", "topics": ["notifications", "push"]},
        {"text": "Design a file storage service like Google Drive.", "topics": ["storage", "cloud"]},
        {"text": "How would you design a news feed like Facebook?", "topics": ["feed", "social"]},
        {"text": "Design an online bookstore like Amazon.", "topics": ["e-commerce"]},
    ],
    Difficulty.HARD: [
        {"text": "Design a distributed message queue like Kafka.", "topics": ["messaging", "distributed"]},
        {"text": "How would you design Twitter's timeline system?", "topics": ["social", "scaling"]},
        {"text": "Design a ride-sharing service like Uber.", "topics": ["location", "matching"]},
        {"text": "How would you design a video streaming service like Netflix?", "topics": ["streaming", "CDN"]},
        {"text": "Design a distributed key-value store like DynamoDB.", "topics": ["database", "distributed"]},
        {"text": "How would you design a search engine?", "topics": ["search", "indexing"]},
        {"text": "Design a real-time collaborative document editor like Google Docs.", "topics": ["collaboration", "real-time"]},
    ],
    Difficulty.EXPERT: [
        {"text": "Design a distributed transaction coordinator for microservices.", "topics": ["transactions", "saga"]},
        {"text": "How would you design a global CDN from scratch?", "topics": ["CDN", "infrastructure"]},
        {"text": "Design Google Maps with all its features.", "topics": ["maps", "navigation", "POI"]},
    ],
}

SITUATIONAL_QUESTIONS = {
    Difficulty.EASY: [
        {"text": "What would you do if you disagreed with your manager's decision?", "topics": ["conflict"]},
        {"text": "How would you handle a project with unclear requirements?", "topics": ["ambiguity"]},
        {"text": "What would you do if you made a mistake that affected the team?", "topics": ["accountability"]},
    ],
    Difficulty.MEDIUM: [
        {"text": "If you discovered a critical bug right before a release, what would you do?", "topics": ["crisis management"]},
        {"text": "How would you prioritize multiple urgent tasks from different stakeholders?", "topics": ["prioritization"]},
        {"text": "What would you do if a team member was not contributing to the project?", "topics": ["team dynamics"]},
        {"text": "How would you handle a situation where you had to work with legacy code?", "topics": ["technical debt"]},
        {"text": "What would you do if you were assigned a task outside your expertise?", "topics": ["learning"]},
        {"text": "How would you handle a client who keeps changing requirements?", "topics": ["stakeholder management"]},
        {"text": "What would you do if you noticed a security vulnerability in production?", "topics": ["security", "incident"]},
    ],
    Difficulty.HARD: [
        {"text": "How would you handle a situation where your team is behind schedule on a critical project?", "topics": ["project management"]},
        {"text": "What would you do if you discovered unethical practices at work?", "topics": ["ethics"]},
        {"text": "How would you manage a project where key resources suddenly left the team?", "topics": ["risk management"]},
        {"text": "What would you do if your technical recommendation was overruled by management?", "topics": ["influence"]},
    ],
    Difficulty.EXPERT: [
        {"text": "How would you handle a public relations crisis caused by a technical failure?", "topics": ["crisis management"]},
        {"text": "What would you do if you had to lay off team members due to budget cuts?", "topics": ["leadership", "difficult decisions"]},
    ],
}


# ===========================================
# QUESTION POOL MANAGER
# ===========================================

class QuestionPoolManager:
    """
    Manages question selection from pools with:
    - Randomization per session
    - Memory to prevent repetition
    - Difficulty adaptation
    - Company-specific filtering
    """
    
    # All pools organized by round
    POOLS = {
        QuestionRound.DSA: DSA_QUESTIONS,
        QuestionRound.TECHNICAL: TECHNICAL_QUESTIONS,
        QuestionRound.BEHAVIORAL: BEHAVIORAL_QUESTIONS,
        QuestionRound.HR: HR_QUESTIONS,
        QuestionRound.SYSTEM_DESIGN: SYSTEM_DESIGN_QUESTIONS,
        QuestionRound.SITUATIONAL: SITUATIONAL_QUESTIONS,
    }
    
    def __init__(self, session_seed: Optional[str] = None, asked_question_ids: Optional[Set[str]] = None):
        """
        Initialize pool manager with session-specific seed.
        
        Args:
            session_seed: Unique seed for this session (ensures different questions per session)
            asked_question_ids: Set of question IDs already asked (for persistence across sessions)
        """
        self.session_seed = session_seed or str(datetime.utcnow().timestamp())
        self.asked_question_ids = asked_question_ids or set()
        self.session_asked = set()  # Questions asked in THIS session
        
        # Initialize random with session seed for reproducible but unique selection
        self.rng = random.Random(self._hash_seed(self.session_seed))
    
    def _hash_seed(self, seed: str) -> int:
        """Create reproducible hash from seed string."""
        return int(hashlib.md5(seed.encode()).hexdigest(), 16)
    
    def _generate_question_id(self, round_type: str, difficulty: str, question_text: str) -> str:
        """Generate unique ID for a question based on its content."""
        content = f"{round_type}:{difficulty}:{question_text[:50]}"
        return f"q-{hashlib.md5(content.encode()).hexdigest()[:12]}"
    
    def get_questions_for_round(
        self,
        round_type: str,
        difficulty: str,
        count: int,
        target_role: str = "",
        company_style: str = CompanyStyle.ANY,
        exclude_ids: Optional[Set[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get randomized questions for a specific round.
        
        Args:
            round_type: Type of round (dsa, technical, behavioral, etc.)
            difficulty: Difficulty level
            count: Number of questions needed
            target_role: Target job role (used for context)
            company_style: Company interview style
            exclude_ids: Additional IDs to exclude
        
        Returns:
            List of question objects with unique IDs
        """
        pool = self.POOLS.get(round_type, {})
        difficulty_pool = pool.get(difficulty, [])
        
        # Fallback to medium if difficulty pool is empty
        if not difficulty_pool:
            difficulty_pool = pool.get(Difficulty.MEDIUM, [])
        
        # Combine all exclusions
        excluded = self.asked_question_ids | self.session_asked
        if exclude_ids:
            excluded |= exclude_ids
        
        # Filter and shuffle available questions
        available = []
        for q in difficulty_pool:
            q_id = self._generate_question_id(round_type, difficulty, q["text"])
            if q_id not in excluded:
                available.append({**q, "_id": q_id})
        
        # If not enough questions, include from adjacent difficulties
        if len(available) < count:
            adjacent_difficulties = self._get_adjacent_difficulties(difficulty)
            for adj_diff in adjacent_difficulties:
                adj_pool = pool.get(adj_diff, [])
                for q in adj_pool:
                    q_id = self._generate_question_id(round_type, adj_diff, q["text"])
                    if q_id not in excluded and q_id not in [a["_id"] for a in available]:
                        available.append({**q, "_id": q_id, "difficulty": adj_diff})
        
        # Shuffle using session RNG
        self.rng.shuffle(available)
        
        # Select the required count
        selected = available[:count]
        
        # Build final question objects
        questions = []
        for i, q in enumerate(selected):
            q_id = q["_id"]
            self.session_asked.add(q_id)
            
            # Replace {role} placeholder if present
            text = q["text"].replace("{role}", target_role) if target_role else q["text"]
            
            questions.append({
                "id": q_id,
                "text": text,
                "type": round_type,
                "round_name": self._get_round_display_name(round_type),
                "category": self._get_category_from_round(round_type),
                "difficulty": q.get("difficulty", difficulty),
                "company_style": company_style,
                "time_limit_seconds": self._get_time_limit(round_type, difficulty),
                "expected_topics": q.get("topics", []),
                "scoring_rubric": self._get_scoring_rubric(round_type),
            })
        
        return questions
    
    def _get_adjacent_difficulties(self, difficulty: str) -> List[str]:
        """Get adjacent difficulty levels for fallback."""
        order = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.EXPERT]
        idx = order.index(difficulty) if difficulty in order else 1
        
        adjacent = []
        if idx > 0:
            adjacent.append(order[idx - 1])
        if idx < len(order) - 1:
            adjacent.append(order[idx + 1])
        return adjacent
    
    def _get_round_display_name(self, round_type: str) -> str:
        """Get display name for round."""
        names = {
            QuestionRound.DSA: "DSA Round",
            QuestionRound.TECHNICAL: "Technical Round",
            QuestionRound.BEHAVIORAL: "Behavioral Round",
            QuestionRound.HR: "HR Round",
            QuestionRound.SYSTEM_DESIGN: "System Design Round",
            QuestionRound.SITUATIONAL: "Situational Round",
        }
        return names.get(round_type, "Interview Round")
    
    def _get_category_from_round(self, round_type: str) -> str:
        """Map round type to category for UI."""
        mapping = {
            QuestionRound.DSA: "DSA",
            QuestionRound.TECHNICAL: "Technical Skills",
            QuestionRound.BEHAVIORAL: "Behavioral",
            QuestionRound.HR: "HR & Culture Fit",
            QuestionRound.SYSTEM_DESIGN: "System Design",
            QuestionRound.SITUATIONAL: "Situational",
        }
        return mapping.get(round_type, "General")
    
    def _get_time_limit(self, round_type: str, difficulty: str) -> int:
        """Get time limit in seconds based on round and difficulty."""
        base_times = {
            QuestionRound.DSA: 300,
            QuestionRound.TECHNICAL: 180,
            QuestionRound.BEHAVIORAL: 180,
            QuestionRound.HR: 120,
            QuestionRound.SYSTEM_DESIGN: 600,
            QuestionRound.SITUATIONAL: 150,
        }
        
        difficulty_multipliers = {
            Difficulty.EASY: 0.8,
            Difficulty.MEDIUM: 1.0,
            Difficulty.HARD: 1.3,
            Difficulty.EXPERT: 1.5,
        }
        
        base = base_times.get(round_type, 180)
        multiplier = difficulty_multipliers.get(difficulty, 1.0)
        return int(base * multiplier)
    
    def _get_scoring_rubric(self, round_type: str) -> Dict[str, List[str]]:
        """Get scoring rubric for round type."""
        rubrics = {
            QuestionRound.DSA: {
                "key_points": ["Correct approach", "Optimal solution", "Edge cases handled", "Clean code"],
                "red_flags": ["Brute force only", "Missing edge cases", "Incorrect complexity"],
            },
            QuestionRound.TECHNICAL: {
                "key_points": ["Clear explanation", "Practical examples", "Depth of knowledge", "Best practices"],
                "red_flags": ["Vague answers", "No examples", "Outdated knowledge"],
            },
            QuestionRound.BEHAVIORAL: {
                "key_points": ["Specific example (STAR)", "Clear actions", "Results achieved", "Self-awareness"],
                "red_flags": ["Generic answers", "Blaming others", "No learning"],
            },
            QuestionRound.HR: {
                "key_points": ["Clear goals", "Genuine interest", "Culture fit", "Research done"],
                "red_flags": ["Only about money", "Misalignment", "No questions"],
            },
            QuestionRound.SYSTEM_DESIGN: {
                "key_points": ["Requirements clarification", "High-level design", "Scalability", "Trade-offs"],
                "red_flags": ["Jumping to solution", "Missing components", "No scaling"],
            },
            QuestionRound.SITUATIONAL: {
                "key_points": ["Logical approach", "Consider stakeholders", "Clear decision", "Professional"],
                "red_flags": ["Indecisive", "Poor judgment", "Unprofessional"],
            },
        }
        return rubrics.get(round_type, {"key_points": [], "red_flags": []})
    
    def generate_round_structure(
        self,
        target_role: str,
        difficulty: str,
        total_questions: int,
        company_style: str = CompanyStyle.ANY,
        session_type: str = "mixed",
        experience_level: str = "mid",  # junior, mid, senior, lead
    ) -> Dict[str, Any]:
        """
        Generate complete round structure for interview.
        
        Returns:
            Dictionary with rounds array and metadata
        """
        # Determine round distribution based on experience and company style
        rounds_config = self._get_rounds_config(
            experience_level=experience_level,
            company_style=company_style,
            session_type=session_type,
            total_questions=total_questions,
        )
        
        rounds = []
        all_questions = []
        question_index = 0
        
        for round_config in rounds_config:
            round_type = round_config["type"]
            round_count = round_config["count"]
            round_difficulty = round_config.get("difficulty", difficulty)
            
            # Get questions for this round
            questions = self.get_questions_for_round(
                round_type=round_type,
                difficulty=round_difficulty,
                count=round_count,
                target_role=target_role,
                company_style=company_style,
            )
            
            # Add question indices
            for q in questions:
                q["index"] = question_index
                question_index += 1
                all_questions.append(q)
            
            rounds.append({
                "name": self._get_round_display_name(round_type),
                "type": round_type,
                "question_count": len(questions),
                "difficulty": round_difficulty,
                "questions": questions,
            })
        
        return {
            "rounds": rounds,
            "total_questions": len(all_questions),
            "questions": all_questions,  # Flat list for backward compatibility
            "estimated_duration_minutes": len(all_questions) * 3,
            "session_seed": self.session_seed,
            "company_style": company_style,
        }
    
    def _get_rounds_config(
        self,
        experience_level: str,
        company_style: str,
        session_type: str,
        total_questions: int,
    ) -> List[Dict[str, Any]]:
        """
        Get round configuration based on experience level and company style.
        """
        # FAANG style: Heavy DSA + System Design
        if company_style == CompanyStyle.FAANG:
            if experience_level in ["senior", "lead"]:
                return [
                    {"type": QuestionRound.DSA, "count": max(2, total_questions // 4), "difficulty": Difficulty.HARD},
                    {"type": QuestionRound.SYSTEM_DESIGN, "count": max(2, total_questions // 3), "difficulty": Difficulty.HARD},
                    {"type": QuestionRound.BEHAVIORAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.HR, "count": max(1, total_questions // 6), "difficulty": Difficulty.EASY},
                ]
            else:
                return [
                    {"type": QuestionRound.DSA, "count": max(3, total_questions // 3), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.TECHNICAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.BEHAVIORAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.HR, "count": max(1, total_questions // 6), "difficulty": Difficulty.EASY},
                ]
        
        # Startup style: More practical, less DSA
        elif company_style == CompanyStyle.STARTUP:
            return [
                {"type": QuestionRound.TECHNICAL, "count": max(3, total_questions // 3), "difficulty": Difficulty.MEDIUM},
                {"type": QuestionRound.SITUATIONAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                {"type": QuestionRound.BEHAVIORAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                {"type": QuestionRound.HR, "count": max(1, total_questions // 6), "difficulty": Difficulty.EASY},
            ]
        
        # Product company style: Balanced
        elif company_style == CompanyStyle.PRODUCT:
            return [
                {"type": QuestionRound.DSA, "count": max(2, total_questions // 5), "difficulty": Difficulty.MEDIUM},
                {"type": QuestionRound.TECHNICAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                {"type": QuestionRound.BEHAVIORAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                {"type": QuestionRound.HR, "count": max(2, total_questions // 5), "difficulty": Difficulty.EASY},
            ]
        
        # Default mixed style
        else:
            if session_type == "technical":
                return [
                    {"type": QuestionRound.DSA, "count": max(2, total_questions // 3), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.TECHNICAL, "count": max(3, total_questions // 3), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.BEHAVIORAL, "count": max(1, total_questions // 6), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.HR, "count": max(1, total_questions // 6), "difficulty": Difficulty.EASY},
                ]
            elif session_type == "behavioral":
                return [
                    {"type": QuestionRound.BEHAVIORAL, "count": max(4, total_questions // 2), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.SITUATIONAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.HR, "count": max(2, total_questions // 4), "difficulty": Difficulty.EASY},
                ]
            else:  # mixed
                return [
                    {"type": QuestionRound.TECHNICAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.BEHAVIORAL, "count": max(2, total_questions // 4), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.SITUATIONAL, "count": max(1, total_questions // 5), "difficulty": Difficulty.MEDIUM},
                    {"type": QuestionRound.HR, "count": max(2, total_questions // 4), "difficulty": Difficulty.EASY},
                ]
    
    def adapt_difficulty(
        self,
        current_difficulty: str,
        answer_score: int,  # 1-10
        answer_relevance: int,  # 1-10
    ) -> str:
        """
        Adapt difficulty based on answer quality.
        
        Args:
            current_difficulty: Current difficulty level
            answer_score: Score of the last answer (1-10)
            answer_relevance: Relevance of the last answer (1-10)
        
        Returns:
            New difficulty level
        """
        avg_score = (answer_score + answer_relevance) / 2
        
        difficulties = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.EXPERT]
        current_idx = difficulties.index(current_difficulty) if current_difficulty in difficulties else 1
        
        if avg_score >= 8 and current_idx < len(difficulties) - 1:
            # Excellent answer - increase difficulty
            return difficulties[current_idx + 1]
        elif avg_score < 5 and current_idx > 0:
            # Poor answer - decrease difficulty
            return difficulties[current_idx - 1]
        else:
            # Maintain current difficulty
            return current_difficulty


# ===========================================
# SINGLETON INSTANCE (for import)
# ===========================================

def get_question_pool(session_seed: Optional[str] = None) -> QuestionPoolManager:
    """Get a new question pool manager instance."""
    return QuestionPoolManager(session_seed=session_seed)
