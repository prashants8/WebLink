declare module "jsonwebtoken" {
  export function sign(payload: object, secret: string, options?: { algorithm?: string }): string;

  const jwt: {
    sign: typeof sign;
  };

  export default jwt;
}
