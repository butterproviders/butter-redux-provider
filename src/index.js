import {createAsyncAction, createReducer} from 'redux-action-tools'
const debug = require('debug')('butter-redux-provider')

const hashify = (source, keyFn = (k) => k) => (
  source.reduce((acc, cur) => (
    Object.assign(acc, {
      [keyFn(cur)]: cur
    })
  ), {})
)

const makeCreators = (provider) => {
  const {config} = provider

    // HACK: bind all method exported to the provider
     ;['fetch', 'detail', 'random'].map(method => {
    provider[method] = provider[method].bind(provider)
  })

  const addToHash = (state, items) => ({
    ...state,
    ...hashify(items, (k) => (k.id))
  })

  return {
    FETCH: {

      payloadCreator: (syncPayload, dispatch, getState) => {
        const {filters} = getState()

        return provider.fetch(filters)
      },
      handler: (state, {payload}) => {
        const {results} = payload

        return {
          ...state,
          cache: addToHash(state.cache, results),
          items: results.map(i => i.id),
          fetched: true
        }
      }
    },
    DETAIL: {
      payloadCreator: (id, dispatch, getState) => {
        const {cache} = getState()
        return provider.detail(id, cache ? cache[id] : {})
      },
      handler: (state, {payload}) => {
        const {id} = payload

        return {
          ...state,
          cache: addToHash(state.cache, [payload]),
          detail: id
        }
      }
    },
    RANDOM: {
      payloadCreator: (syncPayload, dispatch, getState) => {
        return provider.random()
      },
      handler: (state, {payload}) => {
        const id = payload[id]

        return {
          ...state,
          cache: addToHash(state.cache, [payload]),
          random: id
        }
      }
    },
    UPDATE: {
      payloadCreator: (shouldSucceed, dispatch, getState) => (
        provider.update(shouldSucceed)
      ),
      handler: (state, {payload}) => ({
        ...state,
        fetched: true,
        lastUpdated: payload ? Date.now() : state.lastUpdated
      })
    }
  }
}

const resolveProvider = (Provider, config) => {
  debug(Provider)
  switch (typeof Provider) {
    case 'object':
      return Provider
      break
    case 'function':
      return new Provider(config)
      break
    case 'string':
    default:
      const Instance = require(`butter-provider-${Provider}`)
      return new Instance(config)
  }
}

const makeHandlers = (actionTypes, creators) => {
  const actionKeys = Object.keys(creators)

  return actionKeys.reduce((handlers, cur) => {
    const actionType = actionTypes[cur]

    const reducer = createReducer()
      .when(actionType, (state, {type}) => ({
        ...state,
        isFetching: type}))
      .done((state, action) => (
        creators[cur].handler({
          ...state,
          isFetching: false
        }, action)))
      .failed((state, action) => ({
        ...state,
        failed: action,
        isFetching: false
      }))
      .build()

    return Object.assign(handlers, {
      [actionType]: reducer,
      [`${actionType}_COMPLETED`]: reducer,
      [`${actionType}_FAILED`]: reducer
    })
  }, {})
}

const makeReducer = (handlers) => {
  return (state, action) => {
    const handler = handlers[action.type]

    if (handler) {
      return handler(state, action)
    }

    return {
      isFetching: false,
      fetched: false,
      detail: null,
      random: null,
      lastUpdated: null,
      items: [],
      ...state
    }
  }
}

const makeActionTypes = ({config, id}, creators) => {
  const actionKeys = Object.keys(creators)
  const upperName = id.toUpperCase()

  return actionKeys.reduce((actionTypes, type) => (
    Object.assign(actionTypes, {
      [type]: `BUTTER/PROVIDERS/${upperName}/${type}`
    })
  ), {})
}

const makeActions = (actionTypes, creators) => {
  return Object.keys(actionTypes).reduce((actions, type) => {
    const creator = creators[type]

    return Object.assign(actions, {
      [type]: createAsyncAction(
        actionTypes[type],
        creator.payloadCreator
      )
    })
  }, {})
}

const reduxProviderAdapter = (providerArg, config = {}) => {
  const provider = resolveProvider(providerArg, config)

  const creators = makeCreators(provider)
  const actionTypes = makeActionTypes(provider.config, creators)

  return {
    provider: provider,
    actionTypes: actionTypes,
    actions: makeActions(actionTypes, creators),
    reducer: makeReducer(makeHandlers(actionTypes, creators))
  }
}

export {reduxProviderAdapter as default}
