function element(id){
    return document.getElementById(id)
}

function setTextContent(id, text){
    el = element(id)
    if(el)
        element.textContent = text
}

export function uiUpdateStats(total_length, area_count){
    setTextContent("total_length", `${total_length}km of trails`)
    setTextContent("area_count", `In ${area_count} areas`)
}