import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated user's current usage counts.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_usage_counts", {
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  const dailyLimit = Number(process.env.DAILY_REQUEST_LIMIT) || 30;
  const monthlyLimit = Number(process.env.MONTHLY_REQUEST_LIMIT) || 500;

  return NextResponse.json({
    daily: {
      used: Number(row?.daily_count ?? 0),
      limit: dailyLimit,
    },
    monthly: {
      used: Number(row?.monthly_count ?? 0),
      limit: monthlyLimit,
    },
  });
}
