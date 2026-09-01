// Single place every report resolves a transaction's wallet, so the name and the
// "no wallet" wording stay identical across the system.
//
// A record may carry the wallet already populated by the API (walletId is an
// object) or as a bare id, so both shapes are handled. When no wallet is linked
// the label is 'N/A' rather than the name of a real wallet — inventing one would
// misreport which account the money actually moved through.
export const NO_WALLET_LABEL = 'N/A';

export const walletNameOf = (record, wallets = []) => {
  const linked = record?.walletId;
  if (!linked) return NO_WALLET_LABEL;

  if (typeof linked === 'object') return linked.name || NO_WALLET_LABEL;

  const match = wallets.find(w => String(w._id) === String(linked));
  return match?.name || NO_WALLET_LABEL;
};

// The wallet id as a plain string, for filtering and grouping.
export const walletIdOf = (record) => {
  const linked = record?.walletId;
  if (!linked) return '';
  return String(typeof linked === 'object' ? linked._id : linked);
};
