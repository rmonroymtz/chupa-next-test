/**
 * Customer GraphQL documents, from the legacy PWA Studio storefront so both
 * apps send Magento the same operations:
 * - `SignIn`, `GetCustomerAfterSignIn`, `MergeCartsAfterSignIn`: peregrine
 *   `talons/SignIn/signIn.gql.js` (`mergeCarts` without the checkout fragment,
 *   this storefront only needs it to succeed).
 * - `SignOutFromMenu`: peregrine `talons/Header/accountMenu.gql.js`.
 */

export const SIGN_IN_MUTATION = /* GraphQL */ `
  mutation SignIn($email: String!, $password: String!) {
    generateCustomerToken(email: $email, password: $password) {
      token
    }
  }
`;

export const GET_CUSTOMER_QUERY = /* GraphQL */ `
  query GetCustomerAfterSignIn {
    customer {
      email
      firstname
      lastname
      is_subscribed
    }
  }
`;

export const MERGE_CARTS_MUTATION = /* GraphQL */ `
  mutation MergeCartsAfterSignIn($sourceCartId: String!, $destinationCartId: String!) {
    mergeCarts(source_cart_id: $sourceCartId, destination_cart_id: $destinationCartId) {
      id
    }
  }
`;

export const SIGN_OUT_MUTATION = /* GraphQL */ `
  mutation SignOutFromMenu {
    revokeCustomerToken {
      result
    }
  }
`;
