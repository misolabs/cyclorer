function element(id){
    return document.getElementById(id)
}

function setTextContent(id, text){
    let el = element(id)
    if(el)
        el.textContent = text
}

export function uiUpdateStats(total_length, area_count){
    setTextContent("stats-total-length", `${total_length}km`)
    setTextContent("stats-areas-count", `${area_count}`)
}