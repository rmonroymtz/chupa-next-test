/**
 * Address GraphQL documents, from the legacy PWA Studio storefront so both apps
 * send Magento the same operations:
 * - `GetCustomerAddressesForAddressBook`, `AddNewCustomerAddressToAddressBook`,
 *   `UpdateCustomerAddressInAddressBook`, `DeleteCustomerAddressFromAddressBook`: peregrine
 *   `talons/AddressBookPage/addressBookPage.gql.js` with the chupaprecios-pwa fragment
 *   (`custom_attributes`).
 * - `GetRegions`: the chupaprecios-pwa override of venia-ui `Region/region.gql.js`.
 * - `getSepomexData`: the override of venia-ui `AddressAutocomplete/sepomex.gql.js`.
 * - `AddressFormConfig`: the two `storeConfigData` queries of `@chupaprecios/form-address`
 *   (`useFormAddress`, `useStreet`) in one request.
 */

export const LIST_ADDRESSES_QUERY = /* GraphQL */ `
  query GetCustomerAddressesForAddressBook {
    customer {
      addresses {
        id
        city
        country_code
        default_billing
        default_shipping
        firstname
        lastname
        middlename
        postcode
        region {
          region
          region_code
          region_id
        }
        street
        telephone
        custom_attributes {
          attribute_code
          value
        }
      }
    }
  }
`;

export const CREATE_ADDRESS_MUTATION = /* GraphQL */ `
  mutation AddNewCustomerAddressToAddressBook($address: CustomerAddressInput!) {
    createCustomerAddress(input: $address) {
      id
    }
  }
`;

export const UPDATE_ADDRESS_MUTATION = /* GraphQL */ `
  mutation UpdateCustomerAddressInAddressBook(
    $addressId: Int!
    $updated_address: CustomerAddressInput!
  ) {
    updateCustomerAddress(id: $addressId, input: $updated_address) {
      id
    }
  }
`;

export const DELETE_ADDRESS_MUTATION = /* GraphQL */ `
  mutation DeleteCustomerAddressFromAddressBook($addressId: Int!) {
    deleteCustomerAddress(id: $addressId)
  }
`;

export const REGIONS_QUERY = /* GraphQL */ `
  query GetRegions($countryCode: String!) {
    country(id: $countryCode) {
      id
      available_regions {
        id
        code
        name
      }
    }
  }
`;

export const SEPOMEX_QUERY = /* GraphQL */ `
  query getSepomexData($postal_code: String!) {
    getSepomexData(postal_code: $postal_code) {
      city {
        key
        label
      }
      municipio
      neighborhoods {
        key
        label
      }
      state {
        key
        label
      }
    }
  }
`;

export const FORM_CONFIG_QUERY = /* GraphQL */ `
  query AddressFormConfig {
    storeConfig {
      amasty_checkout_manage_checkout_fields {
        amasty_checkout_checkout_fields
      }
      amasty_checkout_customer_address_street_lines
      amasty_checkout_geolocation_google_address_suggestion
      amasty_checkout_geolocation_google_api_key
    }
  }
`;
