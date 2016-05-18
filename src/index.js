import { createAction, handleAction, handleActions } from 'redux-actions'
let debug = require('debug')('butter-redux-actions')

const types = {
    FETCH  : 'FETCH',
    DETAIL : 'DETAIL',
    RANDOM : 'RANDOM',
    UPDATE : 'UPDATE',
    IDS    : 'IDS'
}

export default class ButterReduxProvider {
    constructor(config) {
        config = Object.assign ({}, {name: 'vodo'}, config)
        debug ('init', config.name)
        this.instance = require(`butter-provider-${config.name}`)
        this.provider = new this.instance(config)
        this.config = Object.assign({}, config, this.provider.config)
    }

    debug() {
        debug(this.config.name, ...arguments)
    }

    types = types

    actions = {
        fetch: createAction(types.FETCH, filters => {
            this.debug('fetch')
            return this.provider.fetch(filters)
        }),
        detail: createAction(types.DETAIL,  (id, old) => {
            this.debug('detail')
            return this.provider.detail(id, old)
        }),
        random: createAction(types.RANDOM,  () => {
            this.debug('random')
            return this.provider.random()
        }),
        update: createAction(types.UPDATE,  () => {
            this.debug('update')
            return this.provider.update()
        }),
        ids: createAction(types.IDS,  items => {
            this.debug('ids')
            return this.provider.extractIds(items)
        })
    }

    reducers = handleActions({
        [types.FETCH]: (state, action) => ({
            ...state,
            fetched: true,
            items: action.payload,
            lastUpdated: state.lastUpdated || Date.now()
        }),
        [types.DETAIL]: (state, action) => ({
            ...state,
            detail: action.payload
        }),
        [types.RANDOM]: (state, action) => ({
            ...state,
            random: action.payload
                                             }),
        [types.UPDATE]: (state, action) =>  ({
            ...state,
            lastUpdated: action.payload?Date.now():state.lastUpdated
        })
    }, {
        isFetching: false,
        fetched: false,
        lastUpdated: null,
        items: [],
        detail: null,
        random: null
    })
}
