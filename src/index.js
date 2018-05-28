import {createAsyncAction, createReducer} from 'redux-action-tools'
const debug = require('debug')('butter-redux-provider')

const hashify = (source, prev = {}) => (
  source.reduce((acc, cur) => (
    Object.assign(acc, {
      [cur.id]: Object.assign({}, prev[cur.id], cur)
    })
  ), {})
)

const makeCreators = (provider, cache) => {
  // HACK: bind all method exported to the provider
  ;['fetch', 'detail', 'random'].map(method => {
    provider[method] = provider[method].bind(provider)
  })

  const addToHash = (state, items) => ({
    ...state,
    ...hashify(items, state)
  })

  return {
    FETCH: {
      payloadCreator: (syncPayload, dispatch, getState) => {
        const {filters} = getState()

        return provider.fetch(filters)
      },
      handler: (state, {payload}) => {
        const {results} = payload

        results.map(item => {
          const prev = cache.get(item.id)

          if (prev) { // check if item was changed.
            cache.set(item.id, Object.assign({}, prev, item))
          } else {
            cache.set(item.id, item)
          }
        })

        return {
          ...state,
          items: results.map(i => i.id),
          fetched: true,
          failed: false
        }
      }
    },
    DETAIL: {
      payloadCreator: (id, dispatch, getState) => provider.detail(id, cache.get(id)),
      handler: (state, {payload}) => {
        const {id} = payload

        cache.set(id, payload)

        return {
          ...state,
          detail: id,
          fetched: true,
          failed: false
        }
      }
    },
    RANDOM: {
      payloadCreator: (syncPayload, dispatch, getState) => {
        return provider.random()
      },
      handler: (state, {payload}) => {
        const id = payload.id

        return {
          ...state,
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
    case 'function':
      return new Provider(config)
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

const fakeCache = {
  get: () => {},
  set: () => {}
}

const reduxProviderAdapter = (providerArg, cache = fakeCache, config = {}) => {
  const provider = resolveProvider(providerArg, config)

  const creators = makeCreators(provider, cache)
  const actionTypes = makeActionTypes(provider, creators)

  return {
    provider: provider,
    actionTypes: actionTypes,
    actions: makeActions(actionTypes, creators),
    reducer: makeReducer(makeHandlers(actionTypes, creators))
  }
}

export {reduxProviderAdapter as default}
