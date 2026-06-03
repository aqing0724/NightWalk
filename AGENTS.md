# NightWalk Agent Guide

## Project Overview

NightWalk is a community-driven safety map application designed to improve pedestrian safety at night.

Users can:
- Report dangerous locations
- View nearby safety incidents on a map
- Receive danger alerts
- Comment and vote on reports
- Build a shared community safety network

The goal of this project is NOT just displaying markers on a map.
The core experience should feel like:
- Real-time
- Community-driven
- Safety-focused
- Mobile-first
- Modern and intuitive

---

# Core Features

## 1. Interactive Safety Map
- Google Maps based interface
- User location shown in real time
- Dangerous areas displayed as markers
- Risk level represented with different colors
- Marker clustering may be added later

## 2. Incident Reports
Users can create reports containing:
- Title
- Description
- Incident type
- Danger level
- Photos
- Timestamp
- Location coordinates

## 3. Community Verification
Users can:
- Vote credible / not credible
- Leave comments
- Discuss incidents

This system is important for increasing report reliability.

## 4. Danger Alerts
When users approach dangerous areas:
- Show warning notifications
- Suggest avoiding the area
- Increase user awareness

---

# Tech Stack

## Frontend
- React Native
- Expo
- expo-router

## Backend
- Firebase Authentication
- Firebase Firestore
- Firebase Storage

## Maps
- react-native-maps
- Google Maps API

## Other Libraries
- expo-location
- expo-image-picker
- react-native-reanimated
- react-native-gesture-handler

---

# Code Architecture

## Folder Structure

/app
- Main routes and pages

/components
- Reusable UI components

/services
- Firebase / API logic

/hooks
- Custom React hooks

/constants
- Theme / colors / configs

/utils
- Helper functions

/assets
- Images / icons

---

# UI / UX Guidelines

## Design Philosophy
The UI should feel:
- Clean
- Dark-mode friendly
- Minimal
- Modern
- Safety-oriented

Avoid:
- Overly colorful UI
- Heavy visual clutter
- Complex interactions

## Map Experience
The map is the MOST IMPORTANT screen.

Requirements:
- Full-screen map
- Smooth animations
- Bottom sheet interaction
- Floating action buttons
- Real-time marker updates

## Bottom Sheet
The report detail card should:
- Support drag gestures
- Have multiple snap points
- Feel similar to Google Maps

---

# Firebase Rules

## Firestore Collections

### reports
Stores safety reports.

Fields:
- id
- title
- description
- type
- dangerLevel
- latitude
- longitude
- imageUrls
- createdAt
- createdBy
- credibilityScore

### comments
Stores report comments.

### users
Stores user profile data.

---

# Authentication

Use Firebase Authentication.

Supported:
- Google Sign-In
- Anonymous browsing (optional future feature)

Never hardcode secrets into source code.

Use:
- .env
- EXPO_PUBLIC_* variables

---

# Coding Rules

## General
- Use functional components only
- Use hooks instead of class components
- Keep components modular
- Avoid giant files

## Naming
- PascalCase for components
- camelCase for variables/functions

## Styling
- Prefer StyleSheet
- Avoid inline styles unless necessary

## Performance
- Avoid unnecessary re-renders
- Use memoization when useful
- Optimize map markers

---

# Important Context

This app is being developed for:
- Student project competitions
- Portfolio use
- Potential future real-world deployment

The project should prioritize:
1. User experience
2. Stability
3. Visual polish
4. Smooth interactions

---

# Future Features

Potential future additions:
- Safety heatmap
- AI danger analysis
- Route safety navigation
- Nearby police station quick-call
- News crawling integration
- Real-time incident trends
- Gamification / pets / points system

---

# Current Priorities

Current development priorities:
1. Stable map experience
2. Firebase integration
3. Google authentication
4. Report upload flow
5. Comment system
6. Bottom sheet UI polish

---

# Important Notes For AI Agents

Before modifying code:
- Understand existing architecture first
- Avoid rewriting entire files unnecessarily
- Preserve component structure
- Preserve Expo compatibility
- Avoid introducing native-only dependencies unless required

When fixing bugs:
- Explain root cause clearly
- Prefer minimal safe fixes
- Avoid breaking existing UI

When adding features:
- Keep UI consistent
- Follow existing design patterns
- Reuse components whenever possible

