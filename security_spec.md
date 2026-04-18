# SYNKIFY Security Specification

## Data Invariants
1.  **Identity Bond**: Users can only read and write their own profile, goals, and entries.
2.  **Schema Integrity**: All writes must comply with the strict validation helpers.
3.  **Immutable Identity**: Once created, `uid` fields must never change.
4.  **Temporal Truth**: `createdAt` and `updatedAt` must use `request.time`.
5.  **Verified Status**: Users must be authenticated to interact with the system.

## The Dirty Dozen Payloads (Rejection Targets)

1.  **Identity Spoof (Profile)**: Attempt to update another user's profile metadata.
2.  **Identity Spoof (Goal)**: Attempt to create a goal for another user's UID.
3.  **Shadow Field Injection**: Attempt to add a `isAdmin: true` field to the user profile.
4.  **Terminal State Bypass**: Attempt to unmark a `completed: true` goal if the logic didn't anticipate it (not strictly needed here but good to protect).
5.  **Resource Poisoning (ID)**: Attempt to use a 10KB string as an `entryId`.
6.  **Resource Poisoning (Content)**: Attempt to send 5MB of text in a journal `content` field.
7.  **Clock Manipulation**: Attempt to set a custom `createdAt` timestamp from the client.
8.  **Type Mismatch**: Attempt to set `stats.level` to a string `"MAX"`.
9.  **Enum Violation**: Attempt to set `bias` to `"SuperM"`.
10. **Partial Update Gap**: Attempt to update `uid` in a goal document.
11. **Verification Bypass**: Attempt to write as an unverified/anonymous user (if verification was required, but app supports anonymous login currently).
12. **Relationship Orphan**: Attempt to create a goal without a valid user ID format.

## Implementation Plan
I will now generate the `firestore.rules` file to prevent these payloads.
