let lastActionTime = 0;
let consecutiveRapidClicks = 0;
let cooldownUntil = 0;

/**
 * Checks if the user is spamming favorites, watchlist, or likes.
 * If spamming is detected, shows premium user-friendly warnings and initiates a cooldown.
 * 
 * Rules:
 * - 3-second gap is checked. If the action gap is less than 3 seconds, it is marked as rapid.
 * - Allows 5 consecutive rapid clicks.
 * - The 6th rapid click triggers a warning and a 20-second global cooldown.
 * 
 * @param toast Toast function from useUserData or App
 * @returns true if allowed, false if blocked
 */
export function checkSpamAndTriggerCooldown(toast: (msg: string, type: "error" | "success" | "info") => void): boolean {
  const now = Date.now();

  // If currently in cooldown, block and show remaining time
  if (now < cooldownUntil) {
    const remaining = Math.ceil((cooldownUntil - now) / 1000);
    toast(`Please slow down! Cooldown active. Try again in ${remaining} seconds.`, "error");
    return false;
  }

  // Calculate interval since last action
  const interval = now - lastActionTime;
  lastActionTime = now;

  if (interval < 3000) {
    // Increment count because it was a rapid action (< 3 seconds interval)
    consecutiveRapidClicks += 1;
    
    // On the 6th rapid click
    if (consecutiveRapidClicks >= 6) {
      cooldownUntil = now + 20000; // 20 seconds cooldown
      consecutiveRapidClicks = 0; // reset
      toast("Action blocked! Too many rapid actions. Please wait 20 seconds to try again.", "error");
      return false;
    }
  } else {
    // Reset back to 1 since we had a proper gap >= 3 seconds
    consecutiveRapidClicks = 1;
  }

  return true;
}
