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
      if (error.message.includes('INSUFFICIENT_BALANCE')) throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Số dư không đủ.');
      const message = String(error.message || '').toLowerCase();
      const canFallback = ['function', 'schema cache', 'p_admin_id', 'does not exist'].some((hint) => message.includes(hint));
      if (!canFallback) throw new AppError(500, 'TRANSACTION_FAILED', error.message);

      let nextBalance: number | null = null;
      for (let attempt = 0; attempt < 3 && nextBalance === null; attempt += 1) {
        const { data: wallet, error: walletError } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
        if (walletError || !wallet) throw new AppError(404, 'WALLET_NOT_FOUND', 'Không tìm thấy ví người dùng.');
        const candidate = Number(wallet.balance) + amount;
        if (candidate < 0) throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Số dư không đủ.');
        const { data: updatedWallet, error: updateError } = await supabaseAdmin.from('wallets').update({ balance: candidate, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('balance', wallet.balance).select('balance').maybeSingle();
        if (!updateError && updatedWallet) nextBalance = Number(updatedWallet.balance);
      }
      if (nextBalance === null) throw new AppError(409, 'WALLET_CONFLICT', 'Ví vừa được cập nhật bởi giao dịch khác. Vui lòng thử lại.');
      const { error: auditError } = await supabaseAdmin.from('wallet_transactions').insert({ user_id: userId, amount, type, reason, admin_id: adminId || null });
      if (auditError) throw new AppError(500, 'TRANSACTION_AUDIT_FAILED', auditError.message);
      return { balance: nextBalance, fallback: true };
    }

    return data;
  }
}

export const walletService = new WalletService();