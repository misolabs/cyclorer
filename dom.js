function element(id){
    return document.getElementById(id)
}

function setTextContent(id, text){
    let el = element(id)
    if(el)
        el.textContent = text
}

export function uiUpdateStats(total_length, area_count){
    setTextContent("total_length", `${total_length}km of trails`)
    setTextContent("area_count", `In ${area_count} areas`)
}