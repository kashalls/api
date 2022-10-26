export const messages = {
    badRequestErrorMessage: 'Authorization header has incorrent Bearer format.',
    noAuthorizationInHeaderMessage: 'Authorization header is not present.',
    authorizationTokenExpiredMessage: 'Authorization token is no longer valid.',
    authorizationTokenInvalid: (err) => {
      return `Authorization token is invalid: ${err.message}`
    }
}