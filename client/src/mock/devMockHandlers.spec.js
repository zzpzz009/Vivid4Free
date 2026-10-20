import { describe, expect, it } from 'vitest'
import { buildCommonImagesResponse } from '../../mock/handlers/common.js'

describe('buildCommonImagesResponse', () => {
  it('paginates and sorts stably by name asc', () => {
    const files = ['b.png', 'a.png', '10.png', '2.png']
    const res = buildCommonImagesResponse(files, '/gallery/common', { page: 1, limit: 2, orderBy: 'name', orderDirection: 'ASC' })
    expect(res.success).toBe(true)
    expect(res.pagination.page).toBe(1)
    expect(res.pagination.limit).toBe(2)
    expect(res.pagination.total).toBe(4)
    expect(res.images.map((i) => i.name)).toEqual(['2.png', '10.png'])
  })

  it('supports desc ordering', () => {
    const files = ['b.png', 'a.png', '10.png', '2.png']
    const res = buildCommonImagesResponse(files, '/gallery/common', { page: 1, limit: 3, orderBy: 'name', orderDirection: 'DESC' })
    expect(res.images.map((i) => i.name)).toEqual(['b.png', 'a.png', '10.png'])
  })
})

