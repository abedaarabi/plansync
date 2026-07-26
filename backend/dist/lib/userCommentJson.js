/** Public user fields embedded on comment JSON responses. */
export const userPublicSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
};
export const commentAuthorInclude = {
    author: { select: userPublicSelect },
};
export function simpleCommentJson(cm) {
    return {
        id: cm.id,
        body: cm.body,
        createdAt: cm.createdAt.toISOString(),
        author: cm.author,
    };
}
