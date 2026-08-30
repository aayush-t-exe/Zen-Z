import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyOptionWeights, applyScaleMapping, buildScoreRows, type DimensionTotals } from "./logic.ts";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Identify the caller from their own JWT — never trust a user_id
    // supplied in the request body, or any authenticated student could
    // request (and force a recompute of) any other student's scores.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user_id = caller.id;

    // Service role for the actual read/write work — RLS on
    // personality_answers/scores already scopes a student to their own
    // rows, but the scoring math needs personality_option_weights and
    // personality_scale_mappings too, and user_id is now trustworthy.
    const supabase = createClient(supabaseUrl, serviceKey);

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
        // RLS lets a student insert/update their own personality_answers
        // rows directly (needed for the app's own upsert), so a
        // hand-crafted request could set selected_option_ids to option ids
        // belonging to a *different* question to pull in unrelated
        // dimension weights. Only score option ids that actually belong to
        // this answer's question_id.
        const { data: validOptions, error: validOptionsError } = await supabase
          .from("personality_question_options")
          .select("id")
          .eq("question_id", answer.question_id)
          .in("id", answer.selected_option_ids);

        if (validOptionsError) {
          console.error(`Failed to validate option ids: ${validOptionsError.message}`);
          continue;
        }

        const validOptionIds = (validOptions ?? []).map((o) => o.id);

        if (validOptionIds.length > 0) {
          // Fetch weights for these options
          const { data: weights, error: weightsError } = await supabase
            .from("personality_option_weights")
            .select("dimension_id, weight")
            .in("option_id", validOptionIds);

          if (weightsError) {
            console.error(`Failed to fetch weights: ${weightsError.message}`);
            continue;
          }

          if (weights) {
            applyOptionWeights(dimensionTotals, weights);
          }
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
