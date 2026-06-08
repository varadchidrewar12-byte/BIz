import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';

const paymentsService = new PaymentsService();

export class PaymentsController {
  /**
   * POST /api/payments/create-order
   * Create Razorpay order
   */
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { booking_id, consultant_id, client_id, amount, currency } = req.body;

      if (!booking_id || !consultant_id || !client_id || !amount) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const order = await paymentsService.createOrder(
        booking_id,
        consultant_id,
        client_id,
        amount,
        currency || 'INR'
      );

      res.status(201).json(order);
    } catch (error) {
      res.status(500).json({ error: `Failed to create order: ${error}` });
    }
  }

  /**
   * POST /api/payments/verify
   * Verify payment
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        res.status(400).json({ error: 'Missing payment details' });
        return;
      }

      const isValid = paymentsService.verifyPaymentSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

      if (!isValid) {
        res.status(400).json({ error: 'Invalid payment signature' });
        return;
      }

      // Update payment status to completed via service
      const updatedPayment = await paymentsService.updatePaymentStatus(
        razorpayOrderId,
        'completed',
        razorpayPaymentId
      );

      res.json({ message: 'Payment verified successfully', payment: updatedPayment });
    } catch (error) {
      res.status(500).json({ error: `Verification failed: ${error}` });
    }
  }

  /**
   * POST /api/payments/webhook
   * Razorpay webhook handler
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
      const signature = req.headers['x-razorpay-signature'];
      const body = JSON.stringify(req.body);

      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== signature) {
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }

      const payment = await paymentsService.handlePaymentWebhook(req.body);

      res.json({ message: 'Webhook processed', payment });
    } catch (error) {
      res.status(500).json({ error: `Webhook processing failed: ${error}` });
    }
  }

  /**
   * GET /api/payments/:paymentId
   * Get payment details
   */
  async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const payment = await paymentsService.getPaymentById(paymentId);

      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch payment: ${error}` });
    }
  }

  /**
   * GET /api/payments/consultant/:consultantId
   * Get consultant's payments
   */
  async getConsultantPayments(req: Request, res: Response): Promise<void> {
    try {
      const { consultantId } = req.params;
      const { status } = req.query;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = parseInt(req.query.skip as string) || 0;

      const { payments, total } = await paymentsService.getConsultantPayments(
        consultantId,
        status as string,
        limit,
        skip
      );

      res.json({
        payments,
        pagination: { limit, skip, total },
      });
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch payments: ${error}` });
    }
  }

  /**
   * GET /api/payments/consultant/:consultantId/stats
   * Get payment statistics
   */
  async getPaymentStats(req: Request, res: Response): Promise<void> {
    try {
      const { consultantId } = req.params;
      const stats = await paymentsService.getPaymentStats(consultantId);
      const methodStats = await paymentsService.getPaymentMethodStats(consultantId);

      res.json({
        stats,
        methodStats,
      });
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch stats: ${error}` });
    }
  }

  /**
   * POST /api/payments/:paymentId/refund
   * Refund payment
   */
  async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { refund_amount, refund_reason } = req.body;

      const refund = await paymentsService.refundPayment(
        paymentId,
        refund_amount,
        refund_reason
      );

      res.json({ message: 'Payment refunded successfully', refund });
    } catch (error) {
      res.status(500).json({ error: `Refund failed: ${error}` });
    }
  }
}