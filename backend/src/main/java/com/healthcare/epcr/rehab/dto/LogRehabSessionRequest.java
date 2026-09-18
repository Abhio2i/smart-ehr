package com.healthcare.epcr.rehab.dto;

import java.util.List;

public class LogRehabSessionRequest {

    private String sessionDate;
    private int durationMinutes;
    private List<String> activitiesPerformed;
    private String progressNotes;

    public LogRehabSessionRequest() {}

    // Getters and Setters
    public String getSessionDate() { return sessionDate; }
    public void setSessionDate(String sessionDate) { this.sessionDate = sessionDate; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public List<String> getActivitiesPerformed() { return activitiesPerformed; }
    public void setActivitiesPerformed(List<String> activitiesPerformed) { this.activitiesPerformed = activitiesPerformed; }

    public String getProgressNotes() { return progressNotes; }
    public void setProgressNotes(String progressNotes) { this.progressNotes = progressNotes; }
}
