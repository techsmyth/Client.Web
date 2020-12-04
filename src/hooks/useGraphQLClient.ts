import { ApolloLink, createHttpLink, from, InMemoryCache, NormalizedCacheObject, Operation } from '@apollo/client';
import { ApolloClient } from '@apollo/client/core/ApolloClient';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { useDispatch } from 'react-redux';
import { env } from '../env';
import { typePolicies } from '../graphql/cache/typePolicies';
import { pushError } from '../reducers/error/actions';
import { TOKEN_STORAGE_KEY } from './useAuthentication';
import { useAuthenticate } from './useAuthenticate';
import { updateStatus } from '../reducers/auth/actions';
import { useAuthenticationContext } from './useAuthenticationContext';

const enableQueryDebug = !!(env && env?.REACT_APP_DEBUG_QUERY === 'true');

export const useGraphQLClient = (graphQLEndpoint: string): ApolloClient<NormalizedCacheObject> => {
  const dispatch = useDispatch();
  const { status } = useAuthenticationContext();

  let token: string | null;
  const { safeRefresh } = useAuthenticate();

  const errorLink = onError(({ graphQLErrors, networkError, forward, operation }) => {
    let errors: Error[] = [];

    if (graphQLErrors) {
      errors = graphQLErrors.reduce<Error[]>((acc, { message, extensions }) => {
        const newMessage = `${message}`;

        const code = extensions && extensions['code'];
        if (code === 'UNAUTHENTICATED' && status !== 'refreshRequested') {
          // TODO [ATS]: Capter correct error and request refresh when token has expired. dispatch(updateStatus('refreshRequested'));

          return acc;
        }

        acc.push(new Error(newMessage));
        return acc;
      }, []);

      for (let err of graphQLErrors) {
        if (
          err.extensions?.code === 'UNAUTHENTICATED' &&
          status &&
          status !== 'refreshing' &&
          status !== 'refreshRequested'
        ) {
          dispatch(updateStatus('refreshRequested'));
          safeRefresh().then(() => updateStatus('done'));
          return forward(operation);
        }
      }
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
    if (status === 'refreshing' || status === 'refreshRequested') return;

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
        // authorization:
        //   'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6ImtnMkxZczJUMENUaklmajRydDZKSXluZW4zOCJ9.eyJhdWQiOiI1MDUwNDFmYy1mY2EyLTRhNzQtODhlZS02ZDUwYTY0MTdlMzgiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNTI0ZTc2MWMtZDE2Mi00ZmRmLWFiNDMtMjg1NTI0NmQ5ODZjL3YyLjAiLCJpYXQiOjE2MDY5ODgwNDMsIm5iZiI6MTYwNjk4ODA0MywiZXhwIjoxNjA2OTkxOTQzLCJhaW8iOiJBWVFBZS84UkFBQUFCcUxnZGM5dy9LYWl0YzRMdzdEdk93OEpwVEFWZFVZY1lkTDVpM3o1RURUQ0VKTHJoZUs5d3o1ckc2TXA3U2ZYbnR5eEcrYmpzazNhUjA4UFVIU3lGcGpEdkZGRXU3ODEwUmtreEo2VDJVOGNPMUM3enhVVjQwbEhZZlZFZ2R5QmlXVTdIQURMOEIxOXduVWNwK3FlUytCKzlJN096UFZETkQxOEVLODlNbE09IiwiYXpwIjoiZmViNmQ4YjEtOGNjMi00ZTdkLWE0MTktYWQ3YjU0NGIwODMyIiwiYXpwYWNyIjoiMCIsImVtYWlsIjoidmFsZW50aW5feWFuYWtpZXZAeWFob28uY28udWsiLCJpZHAiOiJsaXZlLmNvbSIsIm5hbWUiOiJ2YWxlbnRpbl95YW5ha2lldkB5YWhvby5jby51ayBZYW5ha2lldiIsIm9pZCI6IjFhMWYxNTBkLWNlMGMtNDVmZS05ZTYyLTkxZjA0NjY4YzdjMyIsInByZWZlcnJlZF91c2VybmFtZSI6InZhbGVudGluX3lhbmFraWV2QHlhaG9vLmNvLnVrIiwicmgiOiIwLkFBQUFISFpPVW1MUjMwLXJReWhWSkcyWWJMSFl0djdDakgxT3BCbXRlMVJMQ0RKMEFDUS4iLCJzY3AiOiJDaGVycnl0d2lzdC1HcmFwaFFMIiwic3ViIjoiaFJLZGpGbWlzTUJaYTRlSW0zSWNGN2p4aTJqODFaNTV5ejBxczltYXVFZyIsInRpZCI6IjUyNGU3NjFjLWQxNjItNGZkZi1hYjQzLTI4NTUyNDZkOTg2YyIsInV0aSI6InA4NktYZTFrNlV5U2FKV29qS01nQUEiLCJ2ZXIiOiIyLjAifQ.KvtTpIbT66hC-CQzr5Nwe72xX32ZkPE2FVSWvJRL0qB7OzyZXqHzeGx1kK28ORIpkaGyap5-3lJpAiGwm5HBfnIWzl4YiAA3f23XN-Pp2iFpQztlKvS8mKSGqElvlMRBJCkiUeDPgVv4zqzGYxldm0Io4oVSnurkXkrCHtxlq8aRyq6ePExDtfei3JofomQgjlB3D5L0Wq-X9OoqoHa60qunKI0Wpz74nImWQG8BBGJcIvtRaaNl5ITZdpQ4YOqRrlIbvhR_vbBVPX74rHajKrXjla1iTK9neB6wEXmTE2jUMNnCXyRy9hkNMKVy8eIo88kHPwx2h97-a8lkD5NqKg',
      },
    };
  });

  const consoleLink = new ApolloLink((operation, forward) => {
    if (enableQueryDebug) {
      console.log(`starting request for ${operation.operationName}`);
    }
    return forward(operation).map(data => {
      if (enableQueryDebug) {
        console.log(`ending request for ${operation.operationName}`);
        if (enableQueryDebug && operation.operationName === 'userProfile') {
          console.log(data);
        }
      }
      return data;
    });
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
    link: from([authLink, errorLink, retryLink, omitTypenameLink, consoleLink, httpLink]),
    cache: new InMemoryCache({ addTypename: true, typePolicies: typePolicies }),
  });
};

export default useGraphQLClient;
