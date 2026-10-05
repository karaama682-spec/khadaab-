// Single place every report resolves a transaction's wallet, so the name and the
// "no wallet" wording stay identical across the system.
//
// A record may carry the wallet already populated by the API (walletId is an
// object) or as a bare id, so both shapes are handled. When no wallet is linked
// the label is 'N/A' (in the selected language) rather than the name of a real
// wallet — inventing one would misreport which account the money moved through.
import { translate } from '../i18n/core.js';

export const NO_WALLET_LABEL = 'N/A';
const noWalletLabel = () => translate('common.notAvailable');

export const walletNameOf = (record, wallets = []) => {
  const linked = record?.walletId;
  if (!linked) return noWalletLabel();

  if (typeof linked === 'object') return linked.name || noWalletLabel();

  const match = wallets.find(w => String(w._id) === String(linked));
  return match?.name || noWalletLabel();
};

// The wallet id as a plain string, for filtering and grouping.
export const walletIdOf = (record) => {
  const linked = record?.walletId;
  if (!linked) return '';
  return String(typeof linked === 'object' ? linked._id : linked);
};
