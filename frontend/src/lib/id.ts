export const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const random = Math.random().toString(36).slice(2);
    return `id-${Date.now()}-${random}`;
};
