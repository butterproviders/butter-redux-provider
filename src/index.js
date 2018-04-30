import {createAsyncAction, createReducer} from 'redux-action-tools';
const debug = require('debug')('butter-redux-actions')

const hashify = (source, keyFn = (k) => k) => (
    source.reduce((acc, cur) => (
        Object.assign(acc, {
            [keyFn(cur)]: cur
        })
    ), {})
)

function makeCreators(config, provider) {
    const uniqueId = config.uniqueId

    // HACK: bind all method exported to the provider
    Array.from(['fetch', 'detail', 'random']).map(method => {
        provider[method] = provider[method].bind(provider)
    })

    const addToHash = (state, items) => ({
        ...state,
        ...hashify(items, (k) => k[uniqueId])
    })

    return {
        FETCH: {

            payloadCreator: (syncPayload, dispatch, getState) => {
                const {filters} = getState()

                return provider.fetch(filters)
                               .catch(e => Promise.reject('error' + e))
            },
            handler: (state, {payload}) => {
                const {results} = payload

                return {
                    ...state,
                    cache: addToHash(state.cache, results, uniqueId),
                    items: results.map(i => i[uniqueId]),
                    fetched: true
                }
            }
        },
        DETAIL: {
            payloadCreator: (id, dispatch, getState) => {
                const {cache} = getState()
                return provider.detail(id, cache ? cache[id]: {})
            },
            handler: (state, {payload}) => {
                const id = payload[uniqueId]

                return {
                    ...state,
                    cache: {
                        ...state.cache,
                        [id]: payload
                    },
                    detail: id,
                }

            }
        },
        RANDOM: {
            payloadCreator: (syncPayload, dispatch, getState) => {
                return provider.random()
            },
            handler: (state, {payload}) => {
                const id = payload[uniqueId]

                return {
                    ...state,
                    cache: addToHash(state.cache, [{
                        [id]: payload
                    }]),
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
                lastUpdated: payload?Date.now():state.lastUpdated
            })
        }
    }
}

function resolveProvider(provider) {
    switch(typeof provider) {
        case 'object':
            return provider
            break;
        case 'function':
            return new provider()
            break;
        case 'string':
        default:
            const Instance = require(`butter-provider-${provider}`)
            return new Instance()
    }
}

function makeHandlers(actionTypes, creators) {
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
            [`${actionType}_FAILED`]: reducer,
        })
    }, {})
}

function makeReducer(handlers) {
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
            cache: {},
            ...state,
        }
    }
}

function makeActionTypes(config, creators) {
    const actionKeys = Object.keys(creators)
    const upperName = config.name.toUpperCase()

    return actionKeys.reduce((actionTypes, type) => (
        Object.assign(actionTypes, {
            [type]: `BUTTER/PROVIDERS/${upperName}/${type}`
        })
    ), {})
}


function makeActions(actionTypes, creators) {
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
export default class ButterReduxProvider {
    constructor(provider) {
        let config

        this.provider = resolveProvider(provider)

        this.config = Object.assign({}, config, this.provider.config)

        const creators = makeCreators(this.config, this.provider)
        this.actionTypes = makeActionTypes(this.config, creators)
        this.actions = makeActions(this.actionTypes, creators)
        this.reducer = makeReducer(makeHandlers(this.actionTypes, creators))
    }

    debug() {
        debug(this.config.name, ...arguments)
    }
}
