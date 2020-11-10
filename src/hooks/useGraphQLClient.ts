import { ApolloLink, createHttpLink, from, InMemoryCache, NormalizedCacheObject, Operation } from '@apollo/client';
import { ApolloClient } from '@apollo/client/core/ApolloClient';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { typePolicies } from '../graphql/cache/typePolicies';
import { pushError } from '../reducers/error/actions';
import { TOKEN_STORAGE_KEY } from './useAuthentication';

export const useGraphQLClient = (graphQLEndpoint: string): ApolloClient<NormalizedCacheObject> => {
  const dispatch = useDispatch();
  let token: string | null;

  const handleStorageChange = useCallback((e: StorageEvent) => {
    if (e.key === TOKEN_STORAGE_KEY) {
      token = e.newValue;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleStorageChange]);

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    let errors: Error[] = [];

    if (graphQLErrors) {
      errors = graphQLErrors.reduce<Error[]>((acc, { message, extensions }) => {
        const newMessage = `[GraphQL error]: ${message}`;

        const code = extensions && extensions['code'];
        if (code === 'UNAUTHENTICATED') {
          return acc;
        }

        acc.push(new Error(newMessage));
        return acc;
      }, []);
    }

    if (errors.length > 0) {
      console.error(errors);
    }

    if (networkError) {
      // TODO [ATS] handle network errors better;
      const newMessage = `[Network error]: ${networkError}`;
      console.error(newMessage);
      // errors.push(new Error(newMessage));
    }
    errors.forEach(e => dispatch(pushError(e)));
  });

  const authLink = setContext((_, { headers }) => {
    if (!token) {
      token = localStorage.getItem(TOKEN_STORAGE_KEY);
    }
    if (!token) return headers;
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    };
  });

  const httpLink = createHttpLink({
    uri: graphQLEndpoint,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retryIf = (error: any, _operation: Operation) => {
    const doNotRetryCodes = [500, 400];
    return !!error && !doNotRetryCodes.includes(error.statusCode);
  };

  const retryLink = new RetryLink({
    delay: {
      initial: 1000,
      max: 60000,
      jitter: true,
    },
    attempts: {
      max: 25,
      retryIf,
    },
  });

  const omitTypename = (key: string, value: unknown) => {
    return key === '__typename' || key === '_id' || /^\$/.test(key) ? undefined : value;
  };

  /*
    Apollo automatically sends _typename in the query.  This causes
    a failure on the server-side because _typename is not specified
    in the schema. This middleware removes it.
  */
  const omitTypenameLink = new ApolloLink((operation, forward) => {
    if (operation.variables) {
      operation.variables = JSON.parse(JSON.stringify(operation.variables), omitTypename);
    }
    return forward ? forward(operation) : null;
  });

  return new ApolloClient({
    link: from([authLink, errorLink, retryLink, omitTypenameLink, httpLink]),
    cache: new InMemoryCache({ addTypename: true, typePolicies: typePolicies }),
  });
};

export default useGraphQLClient;
