export const getLooneyToolId = (key: string | undefined): string => {
    if (typeof key !== 'string') {
        return '0'
    }
    const [idPartial] = key.split('.').reverse()
    return idPartial
}