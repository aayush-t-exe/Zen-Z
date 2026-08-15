import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { applyOptionWeights, applyScaleMapping, buildScoreRows, type DimensionTotals } from "./logic.ts";

Deno.serve(async (req) => {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all personality answers for this user
    const { data: answers, error: answersError } = await supabase
      .from("personality_answers")
      .select("question_id, selected_option_ids, scale_value")
      .eq("user_id", user_id);

    if (answersError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch answers: ${answersError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!answers || answers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No answers to score" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Accumulate scores per dimension
    const dimensionTotals: DimensionTotals = {};

    // Process each answer
    for (const answer of answers) {
      // Handle multi-select / single-select answers
      if (answer.selected_option_ids && answer.selected_option_ids.length > 0) {
        // Fetch weights for these options
        const { data: weights, error: weightsError } = await supabase
          .from("personality_option_weights")
          .select("dimension_id, weight")
          .in("option_id", answer.selected_option_ids);

        if (weightsError) {
          console.error(`Failed to fetch weights: ${weightsError.message}`);
          continue;
        }

        if (weights) {
          applyOptionWeights(dimensionTotals, weights);
        }
      }

      // Handle scale answers
      if (answer.scale_value !== null && answer.scale_value !== undefined) {
        // Fetch scale mappings for this question
        const { data: mappings, error: mappingsError } = await supabase
          .from("personality_scale_mappings")
          .select("dimension_id, multiplier")
          .eq("question_id", answer.question_id);

        if (mappingsError) {
          console.error(`Failed to fetch mappings: ${mappingsError.message}`);
          continue;
        }

        if (mappings) {
          applyScaleMapping(dimensionTotals, answer.scale_value, mappings);
        }
      }
    }

    // Normalize scores to 0-1 range and prepare upsert rows
    const scoreRows = buildScoreRows(user_id, dimensionTotals, new Date().toISOString());

    // Upsert scores into database
    const { error: upsertError } = await supabase
      .from("personality_scores")
      .upsert(scoreRows, { onConflict: "user_id,dimension_id" });

    if (upsertError) {
      return new Response(
        JSON.stringify({
          error: `Failed to save scores: ${upsertError.message}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Personality scores computed successfully",
        scores: scoreRows,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
