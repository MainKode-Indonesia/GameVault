# Security Specification & Threat Model

## 1. Data Invariants
1. A `Game` document must contain at least 3 screenshots (`screenshots.size() >= 3`), at least 1 download mirror (`downloadLinks.size() >= 1`), valid `rating` (`0 <= rating <= 5`), and server-verified timestamps (`createdAt == request.time`, `updatedAt == request.time`). Only verified admins can create, edit, or delete games.
2. A `Comment` under `/games/{gameId}/comments/{commentId}` cannot exist without a verified parent `/games/{gameId}` document, must carry `userId == request.auth.uid`, and `gameId == gameId`.
3. A `UserProfile` under `/users/{userId}` contains PII (`email`) and is strictly readable only by the owner (`request.auth.uid == userId`) or an admin. Users cannot self-assign `role: 'admin'`.
4. A `WishlistItem` under `/users/{userId}/wishlist/{gameId}` requires ownership (`request.auth.uid == userId`), `userId == userId`, `gameId == gameId`, and an existing parent `/games/{gameId}` document.
5. An `ActivityLog` under `/activities/{activityId}` requires `userId == request.auth.uid` on creation, and `list` / `get` queries enforce `resource.data.userId == request.auth.uid` or verified admin access.

## 2. Dirty Dozen Payloads (Adversarial Verification Matrix)
1. **Unauthenticated Game Creation**: Unauthenticated client attempts `create` on `/games/fake-game` -> `PERMISSION_DENIED`.
2. **Non-Admin Game Modification**: Regular verified user attempts `update` on `/games/chrono-eclipse` changing `title` or `downloadLinks` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Game**: Admin or user sends `isVerified: true` ghost key on `/games/{id}` -> `PERMISSION_DENIED`.
4. **Insufficient Screenshots (< 3)**: Attempt to create a `Game` with `screenshots: ["a.jpg", "b.jpg"]` -> `PERMISSION_DENIED`.
5. **Empty Download Links**: Attempt to create a `Game` with `downloadLinks: []` -> `PERMISSION_DENIED`.
6. **Privilege Escalation in User Profile**: Regular user creates `/users/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
7. **PII Cross-User Read**: User A attempts `get` or `list` on `/users/{userB}` -> `PERMISSION_DENIED`.
8. **Comment Author Spoofing**: User A creates a comment on `/games/g1/comments/c1` with `userId: "userB"` -> `PERMISSION_DENIED`.
9. **Orphaned Wishlist Item**: User attempts to add `nonexistent-game-id` to `/users/{uid}/wishlist/nonexistent-game-id` -> `PERMISSION_DENIED`.
10. **Email Spoofing Admin Bypass**: User with `email: "mainkode4@gmail.com"` and `email_verified: false` attempts admin write -> `PERMISSION_DENIED`.
11. **Path ID Poisoning**: Client attempts `get` or `create` with a 300-character ID containing invalid symbols (`../../etc`) -> `PERMISSION_DENIED`.
12. **Client-Forged Timestamp / Activity Scraping**: User sends arbitrary past `createdAt` or lists `/activities` without matching `userId` -> `PERMISSION_DENIED`.
