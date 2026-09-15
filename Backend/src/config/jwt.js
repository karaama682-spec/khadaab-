// Centralised JWT secret access.
//
// Production MUST provide a real JWT_SECRET via environment variable. If it is
// missing we refuse to fall back to a guessable default, because a known secret
// lets anyone forge authentication tokens. In non-production we allow a clearly
// labelled development-only secret so local work is not blocked.
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET && process.env.JWT_SECRET.trim();

    if (secret) {
        return secret;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is not set. Refusing to sign/verify tokens with an insecure default in production.');
    }

    console.warn('[WARN] JWT_SECRET is not set — using an insecure development-only secret. Do NOT use this in production.');
    return 'dev-only-insecure-secret-change-me';
};

// Called once at startup so a misconfigured production server fails fast and
// loudly instead of silently issuing forgeable tokens.
const assertJwtSecret = () => {
    if (process.env.NODE_ENV === 'production' && !(process.env.JWT_SECRET && process.env.JWT_SECRET.trim())) {
        console.error('FATAL: JWT_SECRET must be set in production. Exiting.');
        process.exit(1);
    }
};

module.exports = { getJwtSecret, assertJwtSecret };
