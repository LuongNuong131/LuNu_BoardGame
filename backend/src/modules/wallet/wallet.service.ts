import { supabaseAdmin } from '../../infrastructure/supabase/client';
import { AppError } from '../../shared/errors/AppError';

export class WalletService {
  async getBalance(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error || !data) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ví.');
    return data.balance;
  }

  async getHistory(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new AppError(500, 'DB_ERROR', 'Không thể tải lịch sử giao dịch.');
    return data;
  }

  async processTransaction(
    userId: string, 
    amount: number, 
    type: string, 
    reason: string, 
    adminId?: string
  ) {
    // Gọi RPC Function đã viết trong SQL để xử lý Transaction Atomicity
    const { data, error } = await supabaseAdmin.rpc('process_wallet_transaction', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_reason: reason,
      p_admin_id: adminId || null
    });

    if (error) {
      if (error.message.includes('INSUFFICIENT_BALANCE')) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Số dư không đủ.');
      }
      throw new AppError(500, 'TRANSACTION_FAILED', error.message);
    }

    return data;
  }
}

export const walletService = new WalletService();