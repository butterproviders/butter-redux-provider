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
        this.config = Object.assign ({}, config, {name: 'vodo'})
        debug ('init', this.config.name)
        this.instance = require(`butter-provider-${this.config.name}`)
        this.provider = new this.instance(config)
    }

    debug() {
        debug(this.config.name, ...arguments)
    }

    types = types

    actions = {
        fetch: createAction(types.FETCH, async filters => {
            this.debug('fetch')
            const result = await this.provider.fetch(filters)
            return result;
        }),
        detail: createAction(types.DETAIL, async id => {
            this.debug('detail')
            const result = await this.provider.detail(id)
            return result;
        }),
        random: createAction(types.RANDOM, async x => {
            this.debug('random')
            const result = await this.provider.random()
            return result;
        }),
        update: createAction(types.UPDATE, async x => {
            this.debug('update')
            const result = await this.provider.update()
            return result;
        }),
        ids: createAction(types.IDS, async items => {
            this.debug('ids')
            const result = await this.provider.extractIds(items)
            return result;
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
