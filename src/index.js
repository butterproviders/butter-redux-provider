import {createAsyncAction, createReducer} from 'redux-action-tools';
const debug = require('debug')('butter-redux-actions')

export default class ButterReduxProvider {
    constructor(provider) {
        let config

        switch(typeof provider) {
            case 'object':
                this.provider = provider
                break;
            case 'function':
                this.provider = new provider()
                break;
            case 'string':
            default:
                const Instance = require(`butter-provider-${provider}`)
                this.provider = new Instance()
        }


        // HACK: bind all method exported to the provider
        Array.from(['fetch', 'detail', 'random']).map(method => {
            this.provider[method] = this.provider[method].bind(this.provider)
        })

        this.config = Object.assign({}, config, this.provider.config)
        const uniqueId = this.config.uniqueId

        const hashify = (source) => (
            source.reduce((acc, cur) => (
                Object.assign(acc, {
                    [cur[uniqueId]]: cur
                })
            ), {})
        )

        const addToHash = (state, items) => ({
            ...state,
            ...hashify(items)
        })

        const creators = {
            FETCH: {
                payloadCreator: (syncPayload, dispatch, getState) => {
                    const {filters} = getState()

                    return this.provider.fetch(filters)
                               .catch(e => Promise.reject('error' + e))
                },
                handler: (state, {payload}) => {
                    const {results} = payload

                    return {
                        ...state,
                        cache: addToHash(state.cache, results),
                        items: results.map(i => i[uniqueId]),
                        fetched: true
                    }
                }
            },
            DETAIL: {
                payloadCreator: (id, dispatch, getState) => {
                    const {cache} = getState()
                    return this.provider.detail(id, cache ? cache[id]: {})
                },
                handler: (state, {payload}) => {
                    const id = payload[uniqueId]

                    return {
                        ...state,
                        cache: addToHash(state.cache, [{
                            [id]: payload
                        }]),
                        detail: id,
                    }

                }
            },
            RANDOM: {
                payloadCreator: (syncPayload, dispatch, getState) => {
                    this.debug('calling', this.provider.random)

                    return this.provider.random()
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
                    this.provider.update(shouldSucceed)
                ),
                handler: (state, {payload}) => ({
                    ...state,
                    lastUpdated: payload?Date.now():state.lastUpdated
                })
            }
        }

        const upperName = this.config.name.toUpperCase()
        const actionKeys = Object.keys(creators)
        this.actionTypes = actionKeys.reduce((acc, type) => (Object.assign(acc, {
            [type]: `BUTTER/PROVIDERS/${upperName}/${type}`
        })), {})

        this.actions = actionKeys.reduce((acc, type) => {
            const creator = creators[type]

            return Object.assign(acc, {
                [type]: createAsyncAction(
                    this.actionTypes[type],
                    creator.payloadCreator
                )
            })
        }, {})

        this.debug('ACTIONS', this.actions)

        const handlers = actionKeys.reduce((acc, cur) => {
            const actionType = this.actionTypes[cur]

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

            return Object.assign(acc, {
                [actionType]: reducer,
                [`${actionType}_COMPLETED`]: reducer,
                [`${actionType}_FAILED`]: reducer,
            })
        }, {})

        this.reducer = (state, action) => {
            const handler = handlers[action.type]

            if (handler) {
                return handler(state, action)
            }

            this.debug('no handler found for:', action, 'in my', handlers)
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

        this.debug('REDUCERS', handlers)
    }

    debug() {
        debug(this.config.name, ...arguments)
    }
}
