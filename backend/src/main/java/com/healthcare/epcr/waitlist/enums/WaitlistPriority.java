package com.healthcare.epcr.waitlist.enums;

/**
 * Priority levels for waitlist entries.
 * Higher priority score means the patient is sorted earlier in the queue.
 *
 * Scores map to:
 *   URGENT  → 300
 *   HIGH    → 200
 *   ROUTINE → 100
 */
public enum WaitlistPriority {
    URGENT(300),
    HIGH(200),
    ROUTINE(100);

    private final int score;

    WaitlistPriority(int score) {
        this.score = score;
    }

    public int getScore() {
        return score;
    }
}
