/**
 * Conversation Memory Service
 * 
 * Tracks interview conversation context to prevent repetitive responses.
 * Maintains:
 * - Last 3 user answers
 * - Question categories asked
 * - Follow-up phrases used
 * - Concepts already covered
 */

// ===========================================
// MEMORY STORAGE
// ===========================================

class ConversationMemory {
    constructor() {
        this.reset();
    }

    reset() {
        this.answers = [];
        this.questionsAsked = [];
        this.categoriesCovered = new Set();
        this.followUpsUsed = new Set();
        this.conceptsMentioned = new Set();
        this.topicsExplored = new Set();
    }

    /**
     * Add a new answer to memory
     */
    addAnswer(answer) {
        this.answers.push({
            text: answer.text,
            questionId: answer.questionId,
            questionType: answer.questionType,
            timestamp: Date.now(),
            wordCount: (answer.text || '').split(/\s+/).filter(w => w).length,
        });

        // Keep only last 5 answers
        if (this.answers.length > 5) {
            this.answers.shift();
        }

        // Extract concepts from answer
        this.extractConcepts(answer.text);
    }

    /**
     * Add a question to memory
     */
    addQuestion(question) {
        this.questionsAsked.push({
            id: question.id,
            text: question.text,
            type: question.type,
            category: question.category,
            timestamp: Date.now(),
        });

        if (question.category) {
            this.categoriesCovered.add(question.category);
        }
        if (question.type) {
            this.categoriesCovered.add(question.type);
        }
    }

    /**
     * Mark a follow-up phrase as used
     */
    markFollowUpUsed(phrase) {
        const normalized = phrase.toLowerCase().trim();
        this.followUpsUsed.add(normalized);
    }

    /**
     * Check if a follow-up has been used
     */
    isFollowUpUsed(phrase) {
        const normalized = phrase.toLowerCase().trim();
        return this.followUpsUsed.has(normalized);
    }

    /**
     * Extract key concepts from text
     */
    extractConcepts(text) {
        if (!text) return;

        const lower = text.toLowerCase();

        // Technical concepts
        const techPatterns = [
            'microservices', 'api', 'database', 'cache', 'queue',
            'kubernetes', 'docker', 'aws', 'azure', 'gcp',
            'react', 'node', 'python', 'java', 'javascript',
            'sql', 'nosql', 'redis', 'mongodb', 'postgresql',
            'ci/cd', 'testing', 'deployment', 'monitoring',
            'scalability', 'performance', 'security', 'optimization',
        ];

        techPatterns.forEach(pattern => {
            if (lower.includes(pattern)) {
                this.conceptsMentioned.add(pattern);
            }
        });

        // Behavioral topics
        const behavioralPatterns = [
            'leadership', 'teamwork', 'conflict', 'deadline',
            'challenge', 'failure', 'success', 'initiative',
            'communication', 'collaboration', 'mentoring',
        ];

        behavioralPatterns.forEach(pattern => {
            if (lower.includes(pattern)) {
                this.topicsExplored.add(pattern);
            }
        });
    }

    /**
     * Get last N answers
     */
    getLastAnswers(n = 3) {
        return this.answers.slice(-n);
    }

    /**
     * Get answer context for LLM prompt
     */
    getContextForPrompt() {
        const lastAnswers = this.getLastAnswers(3);

        if (lastAnswers.length === 0) {
            return '';
        }

        let context = '\nPrevious candidate answers (for context, do NOT repeat these topics):\n';

        lastAnswers.forEach((answer, index) => {
            const truncated = answer.text.length > 200
                ? answer.text.substring(0, 200) + '...'
                : answer.text;
            context += `${index + 1}. "${truncated}"\n`;
        });

        if (this.conceptsMentioned.size > 0) {
            context += `\nTopics already covered: ${Array.from(this.conceptsMentioned).slice(0, 10).join(', ')}\n`;
        }

        context += '\nDo NOT ask about topics already covered. Ask about NEW areas.\n';

        return context;
    }

    /**
     * Get concepts not yet explored
     */
    getUnexploredConcepts(allConcepts) {
        return allConcepts.filter(c => !this.conceptsMentioned.has(c.toLowerCase()));
    }

    /**
     * Summary for debugging
     */
    getSummary() {
        return {
            answerCount: this.answers.length,
            questionsAsked: this.questionsAsked.length,
            categoriesCovered: Array.from(this.categoriesCovered),
            followUpsUsed: this.followUpsUsed.size,
            conceptsMentioned: Array.from(this.conceptsMentioned),
            topicsExplored: Array.from(this.topicsExplored),
        };
    }
}

// ===========================================
// FOLLOW-UP GENERATION
// ===========================================

const FOLLOW_UP_CATEGORIES = {
    clarification: [
        "Could you clarify what you meant by %CONCEPT%?",
        "When you mentioned %CONCEPT%, what specifically were you referring to?",
        "Help me understand the %CONCEPT% part better.",
    ],
    depth: [
        "What were the specific technical decisions behind that?",
        "How did you measure the success of that approach?",
        "What trade-offs did you consider?",
        "Walk me through your decision-making process.",
    ],
    example: [
        "Can you give me a concrete example of that?",
        "Tell me about a specific instance where you applied this.",
        "What's a real scenario where you faced this?",
    ],
    challenge: [
        "What was the hardest part of that?",
        "If you could do it again, what would you change?",
        "What pushback did you receive on that approach?",
        "What would happen if your solution failed?",
    ],
    impact: [
        "What was the measurable impact of your work?",
        "How did this affect the team or organization?",
        "What was the business outcome?",
    ],
    learning: [
        "What did you learn from that experience?",
        "How has that shaped your approach since?",
        "What would you advise someone facing a similar situation?",
    ],
};

/**
 * Generate a diverse follow-up question
 */
export function generateFollowUp(memory, lastAnswer, questionType = 'general') {
    // Determine which category to use based on answer
    const wordCount = (lastAnswer || '').split(/\s+/).filter(w => w).length;

    let preferredCategories = [];

    if (wordCount < 30) {
        // Short answer - ask for depth or examples
        preferredCategories = ['depth', 'example'];
    } else if (wordCount < 60) {
        // Medium answer - ask for impact or challenges
        preferredCategories = ['impact', 'challenge'];
    } else {
        // Long answer - ask for learning or clarification on specific point
        preferredCategories = ['learning', 'clarification'];
    }

    // Shuffle and pick
    const shuffled = preferredCategories.sort(() => Math.random() - 0.5);

    for (const category of shuffled) {
        const templates = FOLLOW_UP_CATEGORIES[category];
        const shuffledTemplates = templates.sort(() => Math.random() - 0.5);

        for (const template of shuffledTemplates) {
            if (!memory.isFollowUpUsed(template)) {
                memory.markFollowUpUsed(template);

                // Extract a concept to substitute if needed
                let result = template;
                if (template.includes('%CONCEPT%')) {
                    const concepts = Array.from(memory.conceptsMentioned);
                    if (concepts.length > 0) {
                        const concept = concepts[concepts.length - 1];
                        result = template.replace('%CONCEPT%', concept);
                    } else {
                        continue; // Skip this template if no concept
                    }
                }

                return result;
            }
        }
    }

    // Fallback - just move on
    return null;
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

let memoryInstance = null;

export function getConversationMemory() {
    if (!memoryInstance) {
        memoryInstance = new ConversationMemory();
    }
    return memoryInstance;
}

export function resetConversationMemory() {
    if (memoryInstance) {
        memoryInstance.reset();
    }
    memoryInstance = new ConversationMemory();
    return memoryInstance;
}

export default ConversationMemory;
