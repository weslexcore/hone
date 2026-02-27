import { createClient } from "@/lib/supabase/server";

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

/**
 * Check whether a user is within their usage limits, and log the request if allowed.
 * Called from API routes when using the server-side shared key.
 */
export async function checkAndLogUsage(
  userId: string,
  provider: string,
  model: string,
): Promise<UsageCheckResult> {
  const supabase = await createClient();

  const dailyLimit = Number(process.env.DAILY_REQUEST_LIMIT) || 30;
  const monthlyLimit = Number(process.env.MONTHLY_REQUEST_LIMIT) || 500;

  // Get current counts
  const { data, error } = await supabase.rpc("get_usage_counts", {
    p_user_id: userId,
  });

  if (error) {
    // If the RPC fails (e.g., table not set up yet), allow the request
    // but don't log — this prevents breaking the app during setup
    return {
      allowed: true,
      daily: { used: 0, limit: dailyLimit },
      monthly: { used: 0, limit: monthlyLimit },
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const dailyUsed = Number(row?.daily_count ?? 0);
  const monthlyUsed = Number(row?.monthly_count ?? 0);

  const result = {
    daily: { used: dailyUsed, limit: dailyLimit },
    monthly: { used: monthlyUsed, limit: monthlyLimit },
  };

  if (dailyUsed >= dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${dailyUsed}/${dailyLimit}). Resets in 24 hours.`,
      ...result,
    };
  }

  if (monthlyUsed >= monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly limit reached (${monthlyUsed}/${monthlyLimit}). Resets at the start of next month.`,
      ...result,
    };
  }

  // Log the usage
  await supabase.from("usage_logs").insert({
    user_id: userId,
    provider,
    model,
  });

  return {
    allowed: true,
    daily: { used: dailyUsed + 1, limit: dailyLimit },
    monthly: { used: monthlyUsed + 1, limit: monthlyLimit },
  };
}
