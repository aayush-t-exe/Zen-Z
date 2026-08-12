import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'bookingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch booking with slot and activity details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        slot_id,
        status,
        slots:slot_id (
          activity_type_id,
          activity_types:activity_type_id (
            name,
            convenience_fee
          )
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const slot = booking.slots as any;
    const activity = slot?.activity_types as any;
    const amount = (activity?.convenience_fee || 9) * 100; // Convert to paise

    // Get Razorpay credentials from environment
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || 'PLACEHOLDER_KEY_ID';
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || 'PLACEHOLDER_KEY_SECRET';

    // Create Razorpay order
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'INR',
        receipt: `booking_${bookingId}`,
        notes: {
          booking_id: bookingId,
          activity: activity?.name || 'Activity',
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('Razorpay error:', errorData);

      // If using placeholder credentials, return a mock order
      if (razorpayKeyId === 'PLACEHOLDER_KEY_ID') {
        const mockOrderId = `order_${Date.now()}`;

        // Update booking with mock payment_id
        await supabase
          .from('bookings')
          .update({ payment_id: mockOrderId })
          .eq('id', bookingId);

        return new Response(
          JSON.stringify({
            success: true,
            order_id: mockOrderId,
            amount: amount / 100,
            amount_paise: amount,
            booking_id: bookingId,
            is_test_mode: true,
            message: 'Test mode: Using mock order ID. Replace RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET with real credentials.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to create Razorpay order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order = await orderResponse.json();

    // Update booking with payment_id
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ payment_id: order.id })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: order.amount / 100,
        amount_paise: order.amount,
        booking_id: bookingId,
        is_test_mode: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
