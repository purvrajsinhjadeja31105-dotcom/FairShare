/** UPI deep link (NPCI format): opens Google Pay / PhonePe / Paytm with payee and amount filled in. */
export const buildUpiLink = ({ upiId, name, amount }) => {
    const params = [
        `pa=${encodeURIComponent(upiId)}`,
        `pn=${encodeURIComponent(name)}`,
        `am=${Number(amount).toFixed(2)}`,
        'cu=INR',
        `tn=${encodeURIComponent('FairShare settle up')}`
    ];
    return `upi://pay?${params.join('&')}`;
};
