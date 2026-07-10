// {
//   name: 'Dio ð\x9F\x8E§',
//   picture: 'https://firebasestorage.googleapis.com:443/v0/b/locket-img/o/users%2FRCQ94Icmh7fvFr5ycLaHJgyQo8j1%2Fpublic%2Fprofile_pic.webp?alt=media&token=f036e867-b303-449c-8bf2-f47865e5d3c3',
//   revenueCatEntitlements: [],
//   iss: 'https://securetoken.google.com/locket-4252a',
//   aud: 'locket-4252a',
//   auth_time: 1768073577,
//   user_id: 'uid',
//   sub: 'uid',
//   iat: 1768073577,
//   exp: 1768077177,
//   email: 'doibncm2003@gmail.com',
//   email_verified: true,
//   phone_number: '+84329254203',
//   firebase: {
//     identities: { email: [Array], phone: [Array] },
//     sign_in_provider: 'custom'
//   }
// }

const decodeLocketJWT = (token) => {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (err) {
    console.error("❌ Decode token failed:", err);
    return null;
  }
};

module.exports = {
  decodeLocketJWT,
};
