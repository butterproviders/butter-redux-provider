import {createAsyncAction, createReducer} from 'redux-action-tools'
const debug = require('debug')('butter-redux-provider')

const makeCreators = (provider, cache) => {
  // HACK: bind all method exported to the provider
  ;['fetch', 'detail', 'random'].map(method => {
    provider[method] = provider[method].bind(provider)
  })

  return {
    FETCH: {
      promiseCreator: (providerFilters = {page: 0}, dispatch, getState) => {
        let {filters} = getState()
        filters = Object.assign({}, filters, providerFilters)

        return provider.fetch(filters)
          .then(Object.assign.bind(null, {filters}))
      },
      handler: (state, {payload}) => {
        const {results, filters} = payload
        const {page = 0} = filters

        results.map(item => {
          const prev = cache.get(item.id)
          cache.set(item.id, Object.assign({}, prev, item))
        })

        return {
          ...state,
          ids: {
            ...state.ids,
            [page]: results.map(i => i.id)
          },
          fetched: true,
          failed: false,
          filters
        }
      }
    },
    DETAIL: {
      promiseCreator: (id, dispatch, getState) => provider.detail(id, cache.get(id)),
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
      promiseCreator: (syncPayload, dispatch, getState) => {
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
      promiseCreator: (shouldSucceed, dispatch, getState) => (
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
      .when(actionType, ({filters, ...state}, {type}) => ({
        ...state,
        isFetching: {type, filters}}))
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
  }, {filters: {page: 0}})
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
      ids: {},
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
        creator.promiseCreator
      )
    })
  }, {})
}

class SimpleCache {
  constructor () {
    this.store = {}
  }

  get (key) {
    return this.store[key]
  }

  set (key, value) {
    this.store[key] = value
  }

  keys () {
    return Object.keys(this.store)
  }
}

const defaultCache = new SimpleCache()

const reduxProviderAdapter = (providerArg, cache = defaultCache, config = {}) => {
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

export {reduxProviderAdapter as default, SimpleCache}
