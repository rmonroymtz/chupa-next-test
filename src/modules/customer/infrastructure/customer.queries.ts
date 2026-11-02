/**
 * Customer GraphQL documents, from the legacy PWA Studio storefront so both
 * apps send Magento the same operations:
 * - `SignIn`, `GetCustomerAfterSignIn`, `MergeCartsAfterSignIn`: peregrine
 *   `talons/SignIn/signIn.gql.js` (`mergeCarts` without the checkout fragment,
 *   this storefront only needs it to succeed).
 * - `GetCustomerInformation`: the chupaprecios-pwa override of venia-ui
 *   `AccountInformationPage` (`AccountInformationPageFragment`).
 * - `UpdateCustomerPhone`, `SetCustomerInformation`, `ChangeCustomerPassword`: the
 *   chupaprecios-pwa override of venia-ui `EditAccountInformationPage` and peregrine
 *   `useAccountInformationPage`.
 * - `SignOutFromMenu`: peregrine `talons/Header/accountMenu.gql.js`.
 * - `CreateAccount`: peregrine `talons/CreateAccount/createAccount.gql.js`.
 * - `requestPasswordResetEmail`: venia-ui `ForgotPassword/forgotPassword.gql.js`.
 * - `resetPassword`: peregrine `talons/MyAccount/resetPassword.gql.js` (`ResetPassword`).
 * - `GetReCaptchaV3Config`: peregrine `hooks/useGoogleReCaptcha/googleReCaptchaConfig.gql.js`.
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

export const GET_CUSTOMER_PROFILE_QUERY = /* GraphQL */ `
  query GetCustomerInformation {
    customer {
      id
      firstname
      middlename
      lastname
      email
      social_profile_photo
      phone_number
    }
  }
`;

export const UPDATE_CUSTOMER_PHONE_MUTATION = /* GraphQL */ `
  mutation UpdateCustomerPhone($phone: String!) {
    updateCustomer(input: { phone_number: $phone }) {
      customer {
        phone_number
      }
    }
  }
`;

export const SET_CUSTOMER_INFORMATION_MUTATION = /* GraphQL */ `
  mutation SetCustomerInformation($customerInput: CustomerInput!) {
    updateCustomer(input: $customerInput) {
      customer {
        firstname
        lastname
        email
      }
    }
  }
`;

export const CHANGE_CUSTOMER_PASSWORD_MUTATION = /* GraphQL */ `
  mutation ChangeCustomerPassword($currentPassword: String!, $newPassword: String!) {
    changeCustomerPassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      email
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

export const CREATE_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation CreateAccount(
    $email: String!
    $firstname: String!
    $lastname: String!
    $password: String!
    $is_subscribed: Boolean!
  ) {
    createCustomer(
      input: {
        email: $email
        firstname: $firstname
        lastname: $lastname
        password: $password
        is_subscribed: $is_subscribed
      }
    ) {
      customer {
        email
      }
    }
  }
`;

export const REQUEST_PASSWORD_RESET_MUTATION = /* GraphQL */ `
  mutation requestPasswordResetEmail($email: String!) {
    requestPasswordResetEmail(email: $email)
  }
`;

export const RESET_PASSWORD_MUTATION = /* GraphQL */ `
  mutation resetPassword($email: String!, $token: String!, $newPassword: String!) {
    resetPassword(email: $email, resetPasswordToken: $token, newPassword: $newPassword)
  }
`;

export const RECAPTCHA_CONFIG_QUERY = /* GraphQL */ `
  query GetReCaptchaV3Config {
    recaptchaV3Config {
      website_key
      badge_position
      language_code
      forms
    }
  }
`;
