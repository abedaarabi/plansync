/** Public user fields embedded on comment JSON responses. */
export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export type UserPublicRef = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export const commentAuthorInclude = {
  author: { select: userPublicSelect },
} as const;

export function simpleCommentJson(cm: {
  id: string;
  body: string;
  createdAt: Date;
  author: UserPublicRef;
}) {
  return {
    id: cm.id,
    body: cm.body,
    createdAt: cm.createdAt.toISOString(),
    author: cm.author,
  };
}
